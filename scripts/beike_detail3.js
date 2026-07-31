// 第三轮：修正户型提取（贝壳详情页格式为"3室2厅2卫"，无"厨"字），复用第二轮目标清单
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP_PORT = 9333;
const prev = JSON.parse(fs.readFileSync(path.join(__dirname, 'beike_detail2_result.json'), 'utf8'));
const targets = prev.map(p => ({ community: p.community, title: p.title, price: p.price, house: p.house, href: p.url }));
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
      await sleep(3000 + Math.random() * 1500);
      const expr = `(function(){
        const info = { url: location.href };
        const lis = Array.from(document.querySelectorAll('.introContent li'));
        for (const li of lis) {
          const txt = li.textContent.replace(/\\s+/g,'');
          if (txt.includes('房屋户型')) info.huxing = txt.replace('房屋户型','');
          if (txt.includes('配备电梯')) info.elevator = txt.replace('配备电梯','');
          if (txt.includes('建筑面积')) info.area = txt.replace('建筑面积','');
          if (txt.includes('房屋朝向')) info.orient = txt.replace('房屋朝向','');
        }
        if (!info.huxing) {
          const m = document.body.innerText.match(/(\\d室\\d厅(?:\\d厨)?\\d卫)/);
          if (m) info.huxing = m[1];
        }
        return JSON.stringify(info);
      })()`;
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
      const info = JSON.parse(r.result.value || '{}');
      results.push({ community: t.community, title: t.title, price: t.price, house: t.house, ...info });
      console.log(`[OK] ${t.community} ${t.price}万 户型:${info.huxing || '未取到'} 电梯:${info.elevator || '?'} | ${(t.title || '').slice(0, 22)}`);
    } catch (e) {
      results.push({ community: t.community, title: t.title, price: t.price, error: e.message });
      console.log(`[ERR] ${t.community} ${t.price}万 ${e.message}`);
    }
    await sleep(1000 + Math.random() * 1000);
  }
  fs.writeFileSync(path.join(__dirname, 'beike_detail_final.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('SAVED beike_detail_final.json');
  ws.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
