const http = require('http');
const { spawn } = require('child_process');
const WS = require('ws');

function get(path){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9333,path},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});}

(async()=>{
  const list = JSON.parse(await get('/json/list'));
  const page = list.find(t=>t.type==='page');
  const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise(r=>ws.on('open',r));
  const send = (method,params={})=>new Promise(res=>{const id=Math.random();ws.send(JSON.stringify({id,method,params}));ws.on('message',function f(m){const o=JSON.parse(m);if(o.id===id){ws.removeListener('message',f);res(o.result);}});});
  await send('Page.enable');
  // 1) 回贝壳首页"冷却"
  await send('Page.navigate',{url:'https://cd.ke.com/'});
  await new Promise(r=>setTimeout(r,8000));
  const html1 = await send('Runtime.evaluate',{expression:'document.body.innerText.length+" | "+location.href'});
  console.log('首页冷却后:', html1.result.value);
  // 2) 试一个候选详情页
  const url='https://cd.ke.com/ershoufang/106126114942.html';
  await send('Page.navigate',{url});
  await new Promise(r=>setTimeout(r,6000));
  const r2 = await send('Runtime.evaluate',{expression:'(function(){var u=location.href;var t=document.body.innerText;return "LEN="+t.length+" URL="+(u.includes("captcha")?"CAPTCHA":"OK");})()'});
  console.log('详情页:', r2.result.value);
  ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
