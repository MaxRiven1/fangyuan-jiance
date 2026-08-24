(async () => {
  const r = await fetch('https://cd.ke.com/ershoufang/', { credentials: 'include' });
  const t = await r.text();
  const logged = !/登录\s*\/\s*注册/.test(t);
  const m = t.match(/typeUserInfo[\s\S]{0,300}/);
  return JSON.stringify({
    status: r.status,
    loggedGuess: logged,
    hasTokenNow: /lianjia_token=/.test(document.cookie),
    snippet: m ? m[0].replace(/\s+/g, ' ').slice(0, 200) : null
  });
})()
