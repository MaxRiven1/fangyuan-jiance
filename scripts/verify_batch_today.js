// 核验候选低价房源的户型(卫数)：node verify_batch_today.js
const WebSocket = require('ws');
const CDP_PORT = 9333;
const urls = JSON.parse(process.argv[2] || '[]');
async function getPageTarget(){const res=await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);const list=await res.json();return list.find(t=>t.type==='page'&&!t.url.startsWith('devtools'));}
function connect(w){return new Promise((res,rej)=>{const ws=new WebSocket(w,{perMessageDeflate:false});ws.on('open',()=>res(ws));ws.on('error',rej);});}
let mid=0;function send(ws,method,params={}){return new Promise((res,rej)=>{const id=++mid;const on=raw=>{const m=JSON.parse(raw);if(m.id===id){ws.off('message',on);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}};ws.on('message',on);ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{ws.off('message',on);rej(new Error('timeout'));},30000);});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const t=await getPageTarget();
  const ws=await connect(t.webSocketDebuggerUrl);
  await send(ws,'Page.enable');
  for(const url of urls){
    try{
      await send(ws,'Page.navigate',{url});
      await sleep(4000+Math.random()*1500);
      const expr=`(function(){const info={url:location.href};const lis=Array.from(document.querySelectorAll('.introContent li'));for(const li of lis){const txt=li.textContent.replace(/\\s+/g,'');if(txt.includes('房屋户型'))info.huxing=txt.replace('房屋户型','');if(txt.includes('配备电梯'))info.elevator=txt.replace('配备电梯','');if(txt.includes('建筑面积'))info.area=txt.replace('建筑面积','');}if(!info.huxing){const m=document.body.innerText.match(/(\\d室\\d厅(?:\\d厨)?\\d卫)/);if(m)info.huxing=m[1];}return JSON.stringify(info);})()`;
      const r=await send(ws,'Runtime.evaluate',{expression:expr,returnByValue:true});
      const info=JSON.parse(r.result.value||'{}');
      console.log(`[${info.huxing||'未取到'}] 电梯:${info.elevator||'?'} | ${url}`);
    }catch(e){console.log(`[ERR ${e.message}] ${url}`);}
    await sleep(1200+Math.random()*800);
  }
  ws.close();process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
