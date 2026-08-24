const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const PORT = 9333;

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
    setTimeout(() => rej(new Error('timeout ' + m)), 30000);
  });
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pending[j.id]) { pending[j.id](j); delete pending[j.id]; } });
  await new Promise(r => ws.on('open', r));
  await send('Page.enable', {});
  await send('Network.enable', {});

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error('JS: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
    return r.result.result.value;
  };

  // 打开 cd.ke.com
  await send('Page.navigate', { url: 'https://cd.ke.com/' });
  await sleep(4000);

  // 等待页面稳定（可能跳转 hip.ke.com 人机验证，等待自动通过，最多约 40s）
  const t0 = Date.now();
  let finalState = null;
  while (Date.now() - t0 < 45000) {
    try {
      const info = await evaluate(`(() => {
        const u = location.href;
        const body = document.body ? document.body.innerText : '';
        const hasLoginBtn = /登录\s*[\/／]?\s*注册/.test(body) || !!document.querySelector('.login, [class*=loginBtn], a[href*="login"]');
        const cookie = document.cookie;
        const hasToken = /lianjia_token=/.test(cookie);
        const uinfo = document.querySelector('.userinfo, [class*=userInfo], .typeUserInfo');
        const uinfoText = uinfo ? (uinfo.innerText || '').trim().slice(0,40) : '';
        // 顶部右上角用户名（如 15****42）
        const topRight = (document.querySelector('.topbar, .header, #header, .fcTopBanner') || document.body);
        const trText = topRight ? (topRight.innerText || '').replace(/\\s+/g,'').slice(0,80) : '';
        return JSON.stringify({ url: u, hasLoginBtn, hasToken, uinfoText, trText: trText.slice(0,80) });
      })()`);
      const parsed = JSON.parse(info);
      if (parsed.url.includes('hip.ke.com')) {
        process.stderr.write('.. waiting captcha ' + parsed.url + '\n');
        await sleep(4000);
        continue;
      }
      // 已落地 cd.ke.com，读取 cookie 确认
      finalState = parsed;
      break;
    } catch (e) {
      process.stderr.write('eval err: ' + e.message + '\n');
      await sleep(3000);
    }
  }

  if (!finalState) {
    // 兜底：直接读 cookie
    let hasToken = false;
    try {
      const rc = await send('Network.getAllCookies', {});
      hasToken = rc.result.cookies.some(c => c.name === 'lianjia_token');
    } catch (e) {}
    console.log('STATE_TIMEOUT hasToken=' + hasToken);
    process.exit(hasToken ? 0 : 2);
  }

  // 二次确认：读 cookie 中是否有 lianjia_token
  let hasToken = false;
  try {
    const rc = await send('Network.getAllCookies', {});
    hasToken = rc.result.cookies.some(c => c.name === 'lianjia_token');
  } catch (e) {}

  const loggedIn = hasToken && !finalState.hasLoginBtn;
  console.log(JSON.stringify({ url: finalState.url, hasLoginBtn: finalState.hasLoginBtn, cookieHasToken: hasToken, uinfoText: finalState.uinfoText, topRight: finalState.trText, loggedIn }));
  ws.close();
  process.exit(loggedIn ? 0 : 2);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
