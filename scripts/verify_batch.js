// 批量核验房源详情：node verify_batch.js <input.json> <output.json>
// input.json: [{id, url, school, name, type}]  type: 's3'(套三双卫核验) / 's2'(套二单卫核验)
const WebSocket = require('ws');
const fs = require('fs');
const CDP_PORT = 9333;
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outPath = process.argv[3] || 'verify_batch_result.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getPageTarget() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const list = await res.json();
  return list.find(t => t.type === 'page' && !t.url.startsWith('devtools'));
}
function connect(w) {
  return new Promise((res, rej) => { const ws = new WebSocket(w, { perMessageDeflate: false }); ws.on('open', () => res(ws)); ws.on('error', rej); });
}
let mid = 0;
function send(ws, method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++mid;
    const on = raw => { const m = JSON.parse(raw); if (m.id === id) { ws.off('message', on); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
    ws.on('message', on);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.off('message', on); rej(new Error('timeout')); }, 30000);
  });
}

(async () => {
  const t = await getPageTarget();
  const ws = await connect(t.webSocketDebuggerUrl);
  await send(ws, 'Page.enable');
  const expr = `(function(){
    const info={url:location.href};
    const lis=Array.from(document.querySelectorAll('.introContent li'));
    for(const li of lis){const txt=li.textContent.replace(/\\s+/g,'');if(txt.includes('房屋户型'))info.huxing=txt.replace('房屋户型','');if(txt.includes('配备电梯'))info.elevator=txt.replace('配备电梯','');if(txt.includes('建筑面积'))info.area=txt.replace('建筑面积','');if(txt.includes('所在楼层'))info.floor=txt.replace('所在楼层','');}
    if(!info.huxing){const m=document.body.innerText.match(/(\\d室\\d厅(?:\\d厨)?\\d卫)/);if(m)info.huxing=m[1];}
    return JSON.stringify(info);
  })()`;
  const results = [];
  for (const item of input) {
    process.stderr.write('VERIFY ' + item.id + ' ' + item.type + ' ' + item.url + '\n');
    try {
      await send(ws, 'Page.navigate', { url: item.url });
      await sleep(3500 + Math.random() * 1500);
      // 等待详情加载
      let tries = 0, ok = false;
      while (tries < 12 && !ok) { try { const r = await send(ws, 'Runtime.evaluate', { expression: `!!document.querySelector('.introContent')||/房屋户型/.test(document.body.innerText)`, returnByValue: true }); if (r.result && r.result.result && r.result.result.value) { ok = true; } } catch (e) {} tries++; await sleep(800); }
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
      const v = r.result && r.result.result ? r.result.result.value : (r.result ? r.result.value : null);
      let parsed = null; try { parsed = JSON.parse(v); } catch (e) {}
      results.push({ ...item, verify: parsed || { raw: v } });
    } catch (e) {
      results.push({ ...item, error: e.message });
    }
    await sleep(1500 + Math.floor(Math.random() * 1500));
  }
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log('VERIFY DONE -> ' + outPath + ' (' + results.length + ' items)');
  ws.close(); process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
