(()=>{
  const els=[...document.querySelectorAll('div,span,button,a,iframe')].filter(e=>{
    const t=(e.innerText||'').trim();
    return /验证|开始|点击/.test(t) && t.length<30;
  }).slice(0,15).map(e=>({tag:e.tagName,cls:e.className&&e.className.toString().slice(0,60),txt:(e.innerText||'').trim().slice(0,30)}));
  const ifr=[...document.querySelectorAll('iframe')].map(f=>f.src.slice(0,120));
  return JSON.stringify({els,ifr,html:document.body.innerHTML.slice(0,1500)});
})()
