(() => {
  const dlg = document.querySelector('[class*="login-dialog"], [class*="loginModal"], iframe[src*="login"], [class*="qrcode"], canvas');
  const txt = document.body.innerText.slice(0, 300);
  return JSON.stringify({dialogFound: !!dlg, dialogTag: dlg ? (dlg.tagName + '.' + (dlg.className||'').toString().slice(0,60)) : null, url: location.href, textSnippet: txt.replace(/\n+/g,' | ').slice(0,250)});
})()
