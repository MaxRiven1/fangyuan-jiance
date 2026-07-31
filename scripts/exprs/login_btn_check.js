(function(){
  var t=document.body?document.body.innerText:'';
  var hasLoginBtn=/请登录|立即登录/.test(t.slice(0,3000));
  var tel=(t.match(/1[0-9]\*+[0-9]{2,4}/)||[null])[0];
  return JSON.stringify({hasLoginBtn:hasLoginBtn, tel:tel, title:document.title.slice(0,30)});
})()
