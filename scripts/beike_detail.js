// 进入贝壳房源详情页，核实户型的卫生间数量（X室X厅X厨X卫）
// 自动从 beike_result.json 中挑选每个小区最低价的 3室2厅 房源进行核验
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CDP_PORT = 9333;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'beike_result.json'), 'utf8'));

function num(s) { const m = String(s || '').replace(/,/g, '').match(/[\d.]+/); return m ? parseFloat(m[0]) : null; }

// 每个小区挑最低价 3室2厅（红枫岭只看三期）
const targets = [];
for (const key of Object.keys(data)) {
  const listings = Array.isArray(data[key]) ? data[key] : (data[key].listings || []);
  let cands = listings.filter(l => /3室2厅/.test(l.house || ''));
  if (key === 'CH-001') cands = cands.filter(l => /三期/.test(l.title));
  if (key === 'JN-001') cands = cands.filter(l => !/东区/.test(l.title)); // 排除远郊同名"和谐家园东区"
  cands.sort((a, b) => num(a.totalPrice) - num(b.totalPrice));
  if (cands[0]) targets.push({ community: key, title: cands[0].title, price: num(cands[0].totalPrice), href: cands[0].href });
}

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
      await sleep(4000 + Math.random() * 2000);
      const expr = `(function(){
        const info = {};
        info.url = location.href;
        info.title = (document.querySelector('h1.main')||{}).textContent || document.title;
        // 基本信息区："房屋户型 3室2厅1厨2卫"
        const lis = Array.from(document.querySelectorAll('.introContent .base li, .base .content li, .introContent li'));
        for (const li of lis) {
          const txt = li.textContent.replace(/\\s+/g,'');
          if (txt.includes('房屋户型')) info.huxing = txt;
          if (txt.includes('建筑面积')) info.area = txt;
          if (txt.includes('配备电梯')) info.elevator = txt;
          if (txt.includes('所在楼层')) info.floor = txt;
        }
        info.price = (document.querySelector('.price .total')||{}).textContent;
        info.unitPrice = (document.querySelector('.unitPriceValue')||{}).textContent;
        info.community = (document.querySelector('.communityName a.info')||{}).textContent;
        if (!info.huxing) { const m = document.body.innerText.match(/(\\d室\\d厅\\d厨\\d卫)/); if (m) info.huxing = '房屋户型' + m[1]; }
        return JSON.stringify(info);
      })()`;
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
      const info = JSON.parse(r.result.value || '{}');
      results.push({ community: t.community, listTitle: t.title, listPrice: t.price, ...info });
      console.log(`[OK] ${t.community} ${t.title} ${t.price}万 -> ${info.huxing || '未取到'} ${info.elevator || ''}`);
    } catch (e) {
      results.push({ community: t.community, listTitle: t.title, listPrice: t.price, error: e.message });
      console.log(`[ERR] ${t.community} ${e.message}`);
    }
    await sleep(1500 + Math.random() * 1500);
  }
  fs.writeFileSync(path.join(__dirname, 'beike_detail_result.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('SAVED beike_detail_result.json');
  ws.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
