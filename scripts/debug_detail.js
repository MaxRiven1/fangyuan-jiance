const WebSocket = require('ws');
const http=require('http');
const fs=require('fs');
const path=require('path');
function getJSON(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}});}).on('error',rej);});}
function cdpSend(ws,id,method,params){return new Promise((res)=>{ws.send(JSON.stringify({id,method,params:params||{}}));const h=(data)=>{try{const o=JSON.parse(data);if(o.id===id){ws.removeListener('message',h);res(o);}}catch(e){}};ws.on('message',h);});}
(async()=>{
  const cand=JSON.parse(fs.readFileSync(path.join(__dirname,'t2_candidates.json'),'utf8'));
  const url=cand['JN-001'][0].href;
  console.log('navigating:',url);
  const list=await getJSON('http://127.0.0.1:9333/json/list');
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url))||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>ws.on('open',r));
  let id=0;
  await cdpSend(ws,++id,'Page.enable');
  await cdpSend(ws,++id,'Runtime.enable');
  await cdpSend(ws,++id,'Page.navigate',{url});
  await new Promise(r=>setTimeout(r,4000));
  const ev=await cdpSend(ws,++id,'Runtime.evaluate',{expression:`(function(){return JSON.stringify({url:location.href,title:document.title,len:(document.body?document.body.innerText.length:0),text:(document.body?document.body.innerText.slice(0,400):''),hasLogin:document.body?document.body.innerText.includes('登录'):false});})()`,returnByValue:true});
  console.log('RESULT:',ev.result&&ev.result.result&&ev.result.result.value);
  ws.close();
})().catch(e=>{console.error(e);process.exit(1);});
