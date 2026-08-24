// 每日巡检·价格升序补充抓取
// 背景：beike_scrape.js 用默认排序只取第1页(30条封顶)，房源多的小区最低价可能被挤出第1页。
// 本脚本用贝壳 co21(总价升序) + l3/l2(户型过滤) 直链，第1页即为最便宜的30套，可稳定捕获真实最低价。
// 输出：daily_asc_result.json
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const PORT = process.env.CDP_PORT || 9333;

// 覆盖两个池的全部小区（套三池9 + 套二池6，去重后13）
const COMMUNITIES = [
  { id: 'JN-001', name: '和谐家园', search: '和谐家园' },
  { id: 'CH-001', name: '红枫岭三期', search: '红枫岭' },
  { id: 'CH-002', name: '蓝润V客尚东', search: '蓝润V客尚东' },
  { id: 'CH-003', name: '和泓东28', search: '和泓东28' },
  { id: 'CH-004', name: '鼎城上都', search: '鼎城上都' },
  { id: 'JN-002a', name: '蓝光凯丽豪景', search: '凯丽豪景' },
  { id: 'JN-002b', name: '蓝光云鼎', search: '蓝光云鼎' },
  { id: 'JN-003', name: '中加水岸', search: '中加水岸' },
  { id: 'QY-001', name: '万科金色领域', search: '金色领域' },
  { id: 'QY-002', name: '清溪雅筑', search: '清溪雅筑' },
  { id: 'CH-005', name: '花样年花郡', search: '花样年花郡' },
  { id: 'QY-003', name: '时代凯悦', search: '时代凯悦' },
  { id: 'JN-004', name: '西城天下', search: '西城天下' }
];

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page' && (t.url.includes('ke.com') || t.url.includes('lianjia')))
    || targets.find(t => t.type === 'page');
  if (!page) { console.error('NO_PAGE'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pending = {};
  const send = (m, p) => new Promise((res, rej) => {
    const i = ++id; pending[i] = res;
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
    setTimeout(() => rej(new Error('timeout ' + m)), 45000);
  });
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pending[j.id]) { pending[j.id](j); delete pending[j.id]; } });
  await new Promise(r => ws.on('open', r));

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
    return r.result.result.value;
  };
  const waitFor = async (checkExpr, timeoutMs = 18000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evaluate(checkExpr)) return true; } catch (e) {}
      await sleep(800);
    }
    return false;
  };
  const EXTRACT = `(() => {
    const items = Array.from(document.querySelectorAll('.sellListContent > li'));
    const out = [];
    for (const li of items) {
      const titleEl = li.querySelector('.title a');
      const houseEl = li.querySelector('.houseInfo');
      const posEl = li.querySelector('.positionInfo');
      const tpEl = li.querySelector('.totalPrice');
      const upEl = li.querySelector('.unitPrice');
      if (!titleEl || !houseEl || !tpEl) continue;
      out.push({ title: titleEl.textContent.trim(), href: titleEl.href, house: houseEl.textContent.trim().replace(/\\s+/g, ' '), position: posEl ? posEl.textContent.trim().replace(/\\s+/g, ' ') : '', totalPrice: tpEl.textContent.trim().replace(/\\s+/g, ''), unitPrice: upEl ? upEl.textContent.trim() : '' });
    }
    const totalEl = document.querySelector('.resultDes .total span, h2.total span');
    return { total: totalEl ? totalEl.textContent.trim() : '', items: out };
  })()`;

  const results = {};
  for (const c of COMMUNITIES) {
    const rec = { id: c.id, name: c.name, search: c.search, l3: [], l2: [], total3: '', total2: '' };
    for (const room of ['l3', 'l2']) {
      const url = 'https://cd.ke.com/ershoufang/co21' + room + 'rs' + encodeURIComponent(c.search) + '/';
      process.stderr.write('>> ' + c.name + ' ' + room + '\n');
      await send('Page.navigate', { url });
      await sleep(2500);
      const ok = await waitFor(`!!document.querySelector('.sellListContent > li') || /没有找到|暂无房源/.test(document.body.innerText)`, 18000);
      if (!ok) { process.stderr.write('   LOAD_TIMEOUT\n'); continue; }
      let data;
      try { data = await evaluate(EXTRACT); } catch (e) { process.stderr.write('   ERR ' + e.message + '\n'); continue; }
      // 只保留标题/位置含搜索关键词的（排除车位、同名跨盘噪声）
      const filtered = (data.items || []).filter(it => (it.position + ' ' + it.house + ' ' + it.title).includes(c.search));
      rec[room] = filtered;
      rec[room === 'l3' ? 'total3' : 'total2'] = data.total || '';
      await sleep(1800 + Math.floor(Math.random() * 1500));
    }
    results[c.id] = rec;
  }
  fs.writeFileSync(__dirname + '/' + (process.argv[2] || 'daily_asc_result.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('DONE, saved to ' + (process.argv[2] || 'daily_asc_result.json'));
  ws.close(); process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
