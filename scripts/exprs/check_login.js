(() => {
  const t = document.body ? document.body.innerText : '';
  const loginBtn = document.querySelector('.btn-login, a[href*="login"], .typeUserPic');
  const userInfo = document.querySelector('.typeUserInfo, .user-name, .btn-user');
  return JSON.stringify({
    url: location.href,
    title: document.title,
    hasLoginWord: /登录/.test((document.querySelector('.btn-login') || {}).textContent || ''),
    topRightText: (document.querySelector('.fr.nav-user, .nav-user, .header-user, .typeUserInfo') || {}).textContent || '',
    bodyHasMyBeike: /我的贝壳|退出|个人中心/.test(t),
    bodyHead: t.slice(0, 300).replace(/\s+/g, ' ')
  });
})()
