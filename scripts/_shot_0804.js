const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const PORT = 9333;
function getTargets(){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const targets=await getTargets();
  const page=targets.find(t=>t.type==='page'&&t.url.includes('ke.com'))||targets.find(t=>t.type==='page');
  if(!page){console.error('NO_PAGE');process.exit(1);}
  const ws=new WebSocket(page.webSocketDebuggerUrl,{perMessageDeflate:false});
  let id=0;const p={};
  const send=(m,pa)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pa}))});
  ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&p[j.id]){p[j.id](j);delete p[j.id]}});
  await new Promise(r=>ws.on('open',r));
  await send('Page.enable',{});
  // 若页面不在 cd.ke.com 则导航过去
  const cur=await send('Runtime.evaluate',{expression:'location.href',returnByValue:true});
  if(!/ke\.com/.test(cur.result.result.value||'')){
    await send('Page.navigate',{url:'https://cd.ke.com/'});
    await sleep(4000);
  }
  await sleep(1500);
  const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync('login_state_0804.png',Buffer.from(r.result.data,'base64'));
  console.log('SAVED login_state_0804.png');
  ws.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
