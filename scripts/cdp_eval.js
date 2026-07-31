const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.CDP_PORT || 9333;
const EXPR_FILE = process.argv[2];
const fs = require('fs');
const expr = EXPR_FILE ? fs.readFileSync(EXPR_FILE, 'utf8') : process.argv.slice(2).join(' ');

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page' && (t.url.includes('ke.com') || t.url.includes('lianjia')))
    || targets.find(t => t.type === 'page');
  if (!page) { console.error('NO_PAGE'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = {};
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending[mid] = res;
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => rej(new Error('timeout ' + method)), 30000);
  });
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pending[j.id]) { pending[j.id](j); delete pending[j.id]; }
  });
  await new Promise(r => ws.on('open', r));
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  });
  if (r.result && r.result.exceptionDetails) {
    console.error('JS_ERROR:', JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails, null, 1).slice(0, 800));
  } else {
    const v = r.result && r.result.result ? r.result.result.value : undefined;
    console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
  }
  ws.close();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
