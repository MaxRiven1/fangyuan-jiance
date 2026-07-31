const WebSocket = require('ws');
const http=require('http');
const fs=require('fs');
const path=require('path');

function getJSON(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}});}).on('error',rej);});}
function cdpSend(ws,id,method,params){return new Promise((res)=>{const msg={id,method,params:params||{}};ws.send(JSON.stringify(msg));const handler=(data)=>{try{const o=JSON.parse(data);if(o.id===id){ws.removeListener('message',handler);res(o);}}catch(e){}};ws.on('message',handler);});}

(async()=>{
  const list=await getJSON('http://127.0.0.1:9333/json/list');
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url))||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r=>ws.on('open',r));
  let id=0;
  await cdpSend(ws,++id,'Page.enable');
  await cdpSend(ws,++id,'Runtime.enable');
  const cand=JSON.parse(fs.readFileSync(path.join(__dirname,'t2_candidates.json'),'utf8'));
  const targets=[];
  for(const k of Object.keys(cand)){
    const arr=cand[k];
    if(!arr.length) continue;
    targets.push({k,label:'cheapest',item:arr[0]});
    arr.filter(x=>/2室2厅/.test(x.title)).forEach(x=>targets.push({k,label:'2室2厅',item:x}));
  }
  const results={};
  for(const t of targets){
    const url=t.item.href;
    await cdpSend(ws,++id,'Page.navigate',{url});
    // 等待详情页渲染出"房屋户型"
    let txt='';
    for(let i=0;i<12;i++){
      await new Promise(r=>setTimeout(r,800));
      const ev=await cdpSend(ws,++id,'Runtime.evaluate',{expression:'document.body?document.body.innerText:""',returnByValue:true});
      txt=(ev.result&&ev.result.result&&ev.result.result.value)||'';
      if(/房屋户型/.test(txt)) break;
    }
    const ev=await cdpSend(ws,++id,'Runtime.evaluate',{expression:`(function(){const t=document.body.innerText;const m=t.match(/房屋户型[\\s\\S]{0,30}?(\\d室\\d厅\\d卫)/);const e=t.match(/配备电梯[\\s\\S]{0,12}?(有|无)/);const p=(document.querySelector('.total')||{}).innerText||'';return JSON.stringify({huxing:m?m[1]:null,elevator:e?e[1]:null,price:p.replace(/\\n/g,''),len:t.length});})()`,returnByValue:true});
    const val=ev.result&&ev.result.result&&ev.result.result.value;
    const parsed=val?JSON.parse(val):null;
    const key=t.k+'|'+t.label+'|'+t.item.total+'万';
    results[key]=parsed;
    console.log(key,'=>',JSON.stringify(parsed));
  }
  fs.writeFileSync(path.join(__dirname,'t2_verify.json'),JSON.stringify(results,null,2));
  ws.close();
  console.log('DONE');
})().catch(e=>{console.error('ERR',e);process.exit(1);});
