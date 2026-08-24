const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const PORT = process.env.CDP_PORT || 9333;

const COMMUNITIES = [
  { id: 'JN-001', name: '和谐家园', search: '和谐家园', districtHint: ['茶店子', '金牛'] },
  { id: 'CH-001', name: '红枫岭三期', search: '红枫岭', districtHint: ['东郊记忆', '建设路', '成华', '二仙桥'] },
  { id: 'CH-003', name: '和泓东28', search: '和泓东28', districtHint: ['成华', '二仙桥'] },
  { id: 'CH-004', name: '鼎城上都', search: '鼎城上都', districtHint: ['成华', '二仙桥'] },
  { id: 'JN-002a', name: '蓝光凯丽豪景', search: '凯丽豪景', districtHint: ['金牛', '花牌坊'] },
  { id: 'JN-002b', name: '蓝光云鼎', search: '蓝光云鼎', districtHint: ['金牛', '花牌坊'] },
  { id: 'QY-001', name: '万科金色领域', search: '金色领域', districtHint: ['青羊', '万家湾', '光华'] },
  { id: 'QY-002', name: '清溪雅筑', search: '清溪雅筑', districtHint: ['青羊', '万家湾', '光华'] },
  // 2026-08-01 修复：以下两个池内小区在07-31扩围改脚本时被误删，务必保留
  { id: 'CH-002', name: '蓝润V客尚东', search: '蓝润V客尚东', districtHint: ['成华', '二仙桥', '理工大'] },
  { id: 'JN-003', name: '中加水岸', search: '中加水岸', districtHint: ['金牛', '沙河源'] },
  // 2026-07-31 新增14校对口小区
  { id: 'CH-005', name: '花样年花郡', search: '花样年花郡', districtHint: ['成华', '双桥子', '万年场'] },
  { id: 'QY-003', name: '时代凯悦', search: '时代凯悦', districtHint: ['青羊', '骡马市', '西玉龙街'] },
  { id: 'JN-004', name: '西城天下', search: '西城天下', districtHint: ['金牛', '茶店子', '黄忠'] }
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
  const page = targets.find(t => t.type === 'page' && t.url.includes('ke.com')) || targets.find(t => t.type === 'page');
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

  const waitFor = async (checkExpr, timeoutMs = 15000) => {
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
      out.push({
        title: titleEl.textContent.trim(),
        href: titleEl.href,
        house: houseEl.textContent.trim().replace(/\\s+/g, ' '),
        position: posEl ? posEl.textContent.trim().replace(/\\s+/g, ' ') : '',
        totalPrice: tpEl.textContent.trim(),
        unitPrice: upEl ? upEl.textContent.trim() : ''
      });
    }
    const cntEl = document.querySelector('.resultDes .total, h2.total');
    return { count: out.length, totalText: cntEl ? cntEl.textContent.trim().replace(/\\s+/g, '') : '', items: out };
  })()`;

  const results = {};
  for (const c of COMMUNITIES) {
    const url = 'https://cd.ke.com/ershoufang/rs' + encodeURIComponent(c.search) + '/';
    process.stderr.write('>> ' + c.name + ' ' + url + '\n');
    await send('Page.navigate', { url });
    await sleep(2500);
    const ok = await waitFor(`!!document.querySelector('.sellListContent > li') || /没有找到|暂无房源/.test(document.body.innerText)`, 18000);
    if (!ok) { results[c.id] = { name: c.name, error: 'LOAD_TIMEOUT' }; continue; }
    let data;
    try { data = await evaluate(EXTRACT); }
    catch (e) { results[c.id] = { name: c.name, error: e.message }; continue; }
    const kw = c.name.replace(/蓝光|万科|蓝润|和泓/g, '');
    data.items = data.items.filter(it => (it.position + it.house + it.title).includes(kw) || (it.position + it.house).includes(c.search));
    results[c.id] = { name: c.name, search: c.search, url, totalText: data.totalText, listings: data.items };
    await sleep(2000 + Math.floor(Math.random() * 2000));
  }
  fs.writeFileSync(process.argv[2] || 'beike_result.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('DONE, saved to ' + (process.argv[2] || 'beike_result.json'));
  ws.close(); process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
