(() => {
  const c = document.cookie || '';
  const hasToken = /lianjia_token=/.test(c);
  const txt = document.body ? document.body.innerText : '';
  const hasLoginBtn = /登录\s*\/\s*注册|请登录/.test(txt.slice(0, 600));
  const userEl = document.querySelector('.typeUserInfo, .user-name, .userinfo');
  return JSON.stringify({
    url: location.href,
    title: document.title,
    hasToken,
    hasLoginBtn,
    user: userEl ? (userEl.innerText || '').trim().slice(0, 40) : null,
    head: txt.slice(0, 180).replace(/\s+/g, ' ')
  });
})()
