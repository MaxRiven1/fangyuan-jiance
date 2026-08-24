(()=>{
  const b=document.querySelector('.geetest_btn_click');
  if(!b) return JSON.stringify({found:false});
  const r=b.getBoundingClientRect();
  return JSON.stringify({found:true,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:r.width,h:r.height,dpr:window.devicePixelRatio,ck:document.cookie.slice(0,300)});
})()
