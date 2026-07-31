(async()=>{
  const c=document.cookie;
  const hasToken=/lianjia_token=/.test(c);
  const uinfo=document.querySelector('.userinfo, .typeUserInfo, [class*=user]');
  return JSON.stringify({hasToken, uinfoText: uinfo? (uinfo.innerText||'').trim().slice(0,60):null});
})()
