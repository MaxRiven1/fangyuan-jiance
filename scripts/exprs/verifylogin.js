(() => {
  const t = document.body.innerText;
  const hasLogin = /登录\s*\/\s*注册/.test(t.slice(0, 500));
  return JSON.stringify({stillShowLoginBtn: hasLogin, url: location.href, head: t.slice(0, 120).replace(/\n+/g,' | ')});
})()
