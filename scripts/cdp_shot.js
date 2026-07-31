const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const PORT = process.env.CDP_PORT || 9333;
const OUT = process.argv[2] || 'shot.png';

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}
(async () => {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page' && t.url.includes('ke.com')) || targets.find(t => t.type === 'page');
  if (!page) { console.error('NO_PAGE'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pending = {};
  const send = (m, p) => new Promise((res, rej) => { const i = ++id; pending[i] = res; ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => rej(new Error('t')), 20000); });
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pending[j.id]) { pending[j.id](j); delete pending[j.id]; } });
  await new Promise(r => ws.on('open', r));
  await send('Page.bringToFront', {});
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT, Buffer.from(r.result.data, 'base64'));
  console.log('SAVED ' + OUT);
  ws.close(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
