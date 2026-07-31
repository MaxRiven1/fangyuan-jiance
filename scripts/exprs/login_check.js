(async()=>{
  const loginBtn=[...document.querySelectorAll('a')].find(a=>/登录|注册/.test(a.innerText)&&a.offsetParent);
  const userEl=[...document.querySelectorAll('span,a,div')].filter(e=>/^1\d{2}\*+\d{2,4}$/.test((e.innerText||'').trim())).map(e=>e.innerText.trim());
  return JSON.stringify({url:location.href.slice(0,80), hasLoginBtn:!!loginBtn, loginBtnText:loginBtn?loginBtn.innerText.trim():null, maskedPhone:userEl.slice(0,2)});
})()
