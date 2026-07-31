(() => {
  const t = document.title;
  const url = location.href;
  const loginBtn = document.querySelector('.btn-login, [class*="login"], a[href*="login"]');
  return JSON.stringify({title: t, url: url, hasLoginBtn: !!loginBtn, loginBtnText: loginBtn ? loginBtn.textContent.trim().slice(0,30) : null, bodyLen: document.body ? document.body.innerText.length : 0, bodyHead: document.body ? document.body.innerText.slice(0,200) : ''});
})()
