(()=>{
  const c=document.cookie;
  return JSON.stringify({
    url: location.href,
    title: document.title,
    hasToken: /lianjia_token=/.test(c),
    hasLoginBtn: !!document.querySelector('.btn-login, .typeLogin a[href*=login]'),
    userText: (document.querySelector('.typeUserInfo, .userinfo, .user-name')||{innerText:''}).innerText.trim().slice(0,60),
    body: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,250)
  });
})()
