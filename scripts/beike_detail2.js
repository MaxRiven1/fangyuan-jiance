// 第二轮：批量核验重点小区所有 3室2厅 房源的卫生间数，找出每小区"最低价双卫"
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP_PORT = 9333;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'beike_result.json'), 'utf8'));
function num(s) { const m = String(s || '').replace(/,/g, '').match(/[\d.]+/); return m ? parseFloat(m[0]) : null; }

// 需要深查的小区及筛选规则（按价格升序，最多查N套）
const PLAN = [
  { key: 'QY-002', filter: l => true, max: 15 },                       // 清溪雅筑：全查
  { key: 'JN-001', filter: l => !/东区/.test(l.title), max: 5 },      // 和谐家园（排除远郊东区）
  { key: 'CH-001', filter: l => /三期/.test(l.title), max: 6 },        // 红枫岭三期
  { key: 'CH-002', filter: l => num(l.totalPrice) > 95, max: 4 },      // 蓝润：查高价段找双卫
  { key: 'CH-003', filter: l => num(l.totalPrice) > 119, max: 2 },     // 和泓东28
  { key: 'CH-004', filter: l => num(l.totalPrice) > 128, max: 2 },     // 鼎城上都其余
  { key: 'JN-003', filter: l => num(l.totalPrice) > 133, max: 6 }      // 中加水岸：找150内双卫
];

const targets = [];
for (const p of PLAN) {
  const listings = Array.isArray(data[p.key]) ? data[p.key] : (data[p.key].listings || []);
  const cands = listings.filter(l => /3室2厅/.test(l.house || '')).filter(p.filter)
    .sort((a, b) => num(a.totalPrice) - num(b.totalPrice)).slice(0, p.max);
  for (const c of cands) targets.push({ community: p.key, title: c.title, price: num(c.totalPrice), house: c.house, href: c.href });
}
console.log('TOTAL_TARGETS', targets.length);

async function getPageTarget() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const list = await res.json();
  return list.find(t => t.type === 'page' && !t.url.startsWith('devtools'));
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
let msgId = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = raw => {
      const m = JSON.parse(raw);
      if (m.id === id) { ws.off('message', onMsg); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.off('message', onMsg); reject(new Error('timeout ' + method)); }, 30000);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const target = await getPageTarget();
  if (!target) { console.error('NO_PAGE_TARGET'); process.exit(1); }
  const ws = await connect(target.webSocketDebuggerUrl);
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');

  const results = [];
  for (const t of targets) {
    try {
      await send(ws, 'Page.navigate', { url: t.href });
      await sleep(3500 + Math.random() * 1500);
      const expr = `(function(){
        const info = { url: location.href };
        const m = document.body.innerText.match(/(\\d室\\d厅\\d厨\\d卫)/);
        if (m) info.huxing = m[1];
        const lis = Array.from(document.querySelectorAll('.introContent li'));
        for (const li of lis) {
          const txt = li.textContent.replace(/\\s+/g,'');
          if (txt.includes('配备电梯')) info.elevator = txt.replace('配备电梯','');
          if (txt.includes('建筑面积')) info.area = txt.replace('建筑面积','');
        }
        return JSON.stringify(info);
      })()`;
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
      const info = JSON.parse(r.result.value || '{}');
      results.push({ community: t.community, title: t.title, price: t.price, house: t.house, ...info });
      console.log(`[OK] ${t.community} ${t.price}万 ${info.huxing || '未取到'} 电梯:${info.elevator || '?'} | ${t.title.slice(0, 25)}`);
    } catch (e) {
      results.push({ community: t.community, title: t.title, price: t.price, error: e.message });
      console.log(`[ERR] ${t.community} ${t.price}万 ${e.message}`);
    }
    await sleep(1200 + Math.random() * 1200);
  }
  fs.writeFileSync(path.join(__dirname, 'beike_detail2_result.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('SAVED beike_detail2_result.json');
  ws.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
