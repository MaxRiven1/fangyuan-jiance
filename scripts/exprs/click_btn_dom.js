(()=>{
  const b=document.querySelector('.geetest_btn_click');
  if(!b) return 'NO_BTN';
  ['mousedown','mouseup','click'].forEach(t=>b.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window,button:0})));
  return 'DISPATCHED';
})()
