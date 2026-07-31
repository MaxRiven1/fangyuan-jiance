// 核验当日新低房源的详情页户型（卫生间数）与电梯
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const CDP_PORT = 9333;

const stats = JSON.parse(fs.readFileSync(path.join(__dirname, 'daily_stats.json'), 'utf8'));
// 需核验：蓝润V客尚东最低2套、中加水岸最低2套
const targets = [];
for (const id of ['CH-002', 'JN-003']) {
  const s = stats[id];
  if (s && s.最低三套) for (const it of s.最低三套.slice(0, 2)) targets.push({ community: s.name, price: it.price, house: it.house, href: it.href });
}
console.log('TARGETS', targets.length);

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

  const results = [];
  for (const t of targets) {
    try {
      await send(ws, 'Page.navigate', { url: t.href });
      await sleep(3200 + Math.random() * 1500);
      const expr = `(function(){
        const info = { url: location.href };
        const lis = Array.from(document.querySelectorAll('.introContent li'));
        for (const li of lis) {
          const txt = li.textContent.replace(/\\s+/g,'');
          if (txt.includes('房屋户型')) info.huxing = txt.replace('房屋户型','');
          if (txt.includes('配备电梯')) info.elevator = txt.replace('配备电梯','');
          if (txt.includes('建筑面积')) info.area = txt.replace('建筑面积','');
        }
        if (!info.huxing) {
          const m = document.body.innerText.match(/(\\d室\\d厅(?:\\d厨)?\\d卫)/);
          if (m) info.huxing = m[1];
        }
        return JSON.stringify(info);
      })()`;
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
      const info = JSON.parse(r.result.value || '{}');
      results.push({ community: t.community, price: t.price, house: t.house, href: t.href, ...info });
      console.log(`[OK] ${t.community} ${t.price}万 户型:${info.huxing || '未取到'} 电梯:${info.elevator || '?'}`);
    } catch (e) {
      results.push({ community: t.community, price: t.price, error: e.message });
      console.log(`[ERR] ${t.community} ${t.price}万 ${e.message}`);
    }
    await sleep(1200 + Math.random() * 800);
  }
  fs.writeFileSync(path.join(__dirname, 'verify_lows_result.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('SAVED verify_lows_result.json');
  ws.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
