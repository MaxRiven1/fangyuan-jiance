const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const PORT = process.env.CDP_PORT || 9333;

// 14校对口小区候选清单（价格仅来自贝壳登录抓取）
// type: s3=套三双卫候选(卫数待详情核验) s2=套二单卫候选
const COMMUNITIES = [
  // 成华区
  { id: 'CH-SHSH', name: '华润二十四城', search: '华润二十四城', school: '石室小学', district: '成华区', area: '万年场/双桥子' },
  { id: 'CH-SL-1', name: '鹭鸣九章', search: '鹭鸣九章', school: '双林小学', district: '成华区', area: '双桥子' },
  { id: 'CH-CH-1', name: '花样年花郡', search: '花样年花郡', school: '成华小学', district: '成华区', area: '万年场' },
  { id: 'CH-JS-1', name: '万科金域蓝岸', search: '万科金域蓝岸', school: '建设路小学本部', district: '成华区', area: '建设路' },
  { id: 'CH-JS-2', name: '龙湖三千里', search: '龙湖三千里', school: '建设路小学本部', district: '成华区', area: '建业路' },
  { id: 'CH-JSFL-1', name: '万科金色乐府', search: '万科金色乐府', school: '建设路小学枫林校区', district: '成华区', area: '二仙桥' },
  { id: 'CH-JSFL-2', name: '中环光悦居', search: '中环光悦居', school: '建设路小学枫林校区', district: '成华区', area: '二仙桥' },
  { id: 'CH-JSFL-3', name: '东城映象', search: '东城映象', school: '建设路小学枫林校区', district: '成华区', area: '二仙桥' },
  { id: 'CH-JSFL-4', name: '红枫岭', search: '红枫岭', school: '建设路小学枫林校区', district: '成华区', area: '二仙桥' },
  { id: 'CH-JSFL-5', name: '招商华城', search: '招商华城', school: '建设路小学枫林校区', district: '成华区', area: '二仙桥' },
  // 青羊区
  { id: 'QY-DCG-1', name: '新城市广场', search: '新城市广场', school: '东城根街小学', district: '青羊区', area: '西大街/长顺' },
  { id: 'QY-DCG-2', name: '时代凯悦', search: '时代凯悦', school: '东城根街小学', district: '青羊区', area: '西大街' },
  { id: 'QY-DCG-3', name: '红墙国际', search: '红墙国际', school: '东城根街小学', district: '青羊区', area: '红墙巷' },
  { id: 'QY-SC-1', name: '长富新城', search: '长富新城', school: '少城小学', district: '青羊区', area: '长顺上街' },
  { id: 'QY-SC-2', name: '锦都', search: '锦都', school: '少城小学', district: '青羊区', area: '同仁路' },
  { id: 'QY-JS-1', name: '中大君悦金沙', search: '中大君悦金沙', school: '金沙小学', district: '青羊区', area: '金沙' },
  { id: 'QY-JS-2', name: '揽胜金沙', search: '揽胜金沙', school: '金沙小学', district: '青羊区', area: '金沙' },
  { id: 'QY-JS-3', name: '蓝光凯丽美域', search: '蓝光凯丽美域', school: '金沙小学', district: '青羊区', area: '金沙' },
  { id: 'QY-JS-4', name: '金沙鹭岛', search: '金沙鹭岛', school: '金沙小学', district: '青羊区', area: '金沙' },
  // 金牛区
  { id: 'JN-CDZ-1', name: '西城天下', search: '西城天下', school: '茶店子小学', district: '金牛区', area: '茶店子' },
  { id: 'JN-SY-0', name: '后子门', search: '后子门', school: '实验小学本部', district: '青羊区', area: '后子门(代表老破小)' },
  { id: 'JN-PT-0', name: '支矶石街', search: '支矶石街', school: '泡桐树小学本部', district: '青羊区', area: '泡桐树街(代表老破小)' },
  { id: 'JN-SX-0', name: '包家巷', search: '包家巷', school: '胜西小学', district: '青羊区', area: '包家巷(代表老破小)' },
  { id: 'JN-RB-0', name: '白马寺街', search: '白马寺街', school: '人民北路小学', district: '金牛区', area: '白马寺(代表老破小)' }
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
  // 点击"总价"排序一次 => 从低到高（排除车位/储藏室靠室厅字段过滤）
  const CLICK_PRICE_ASC = `(() => {
    const a = Array.from(document.querySelectorAll('a,span,div')).find(e => (e.textContent||'').trim() === '总价');
    if (!a) return 'NO_TOTAL_BTN';
    a.click();
    return 'CLICKED';
  })()`;
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
    process.stderr.write('>> [' + c.school + '] ' + c.name + ' ' + url + '\n');
    await send('Page.navigate', { url });
    await sleep(2500);
    const ok = await waitFor(`!!document.querySelector('.sellListContent > li') || /没有找到|暂无房源/.test(document.body.innerText)`, 18000);
    if (!ok) { results[c.id] = { ...c, error: 'LOAD_TIMEOUT' }; continue; }
    // 价格从低到高排序，确保最便宜的住宅房源出现在首页
    try { await evaluate(CLICK_PRICE_ASC); await sleep(3000); } catch (e) {}
    await waitFor(`!!document.querySelector('.sellListContent > li')`, 12000);
    let data;
    try { data = await evaluate(EXTRACT); }
    catch (e) { results[c.id] = { ...c, error: e.message }; continue; }
    // 过滤：仅保留标题/位置/户型包含搜索词的小区，剔除同名远郊混入
    const kw = c.search;
    data.items = data.items.filter(it => (it.position + ' ' + it.house + ' ' + it.title).includes(kw));
    results[c.id] = { ...c, url, totalText: data.totalText, listings: data.items };
    await sleep(2000 + Math.floor(Math.random() * 2000));
  }
  fs.writeFileSync(process.argv[2] || 'beike_schools_result.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('DONE, saved to ' + (process.argv[2] || 'beike_schools_result.json'));
  ws.close(); process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
