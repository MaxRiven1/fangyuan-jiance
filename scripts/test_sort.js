const WebSocket = require('ws');
const http = require('http');
const PORT = 9333;
function getTargets(){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const targets=await getTargets();
  const page=targets.find(t=>t.type==='page'&&(t.url.includes('ke.com')||t.url.includes('lianjia')))||targets.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl,{perMessageDeflate:false});
  let id=0;const pending={};
  const send=(m,p)=>new Promise((res,rej)=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method:m,params:p}));setTimeout(()=>rej(new Error('timeout '+m)),45000);});
  ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&pending[j.id]){pending[j.id](j);delete pending[j.id];}});
  await new Promise(r=>ws.on('open',r));
  const evaluate=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,200));return r.result.result.value;};
  const waitFor=async(c,t=18000)=>{const t0=Date.now();while(Date.now()-t0<t){try{if(await evaluate(c))return true;}catch(e){}await sleep(800);}return false;};
  const EXTRACT=`(()=>{const items=Array.from(document.querySelectorAll('.sellListContent > li'));return items.slice(0,3).map(li=>{const tp=li.querySelector('.totalPrice');return tp?tp.textContent.replace(/[^\\d.]/g,''):'?';});})()`;
  for(const suffix of ['', '?s=1', '?sort=price-asc', '/?s=1']){
    const url='https://cd.ke.com/ershoufang/rs'+encodeURIComponent('华润二十四城')+suffix+'/';
    await send('Page.navigate',{url}); await sleep(2800);
    await waitFor(`!!document.querySelector('.sellListContent > li')`,15000);
    await sleep(800);
    const prices=await evaluate(EXTRACT).catch(e=>'ERR:'+e.message);
    console.log(suffix||'(default)','-> first3prices=',JSON.stringify(prices),'| url=',url);
    await sleep(1500);
  }
  ws.close();process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
