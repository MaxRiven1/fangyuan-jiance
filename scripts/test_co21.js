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
  const REPORT=`(()=>{const items=Array.from(document.querySelectorAll('.sellListContent > li'));return {count:items.length,first5:items.slice(0,5).map(li=>{const tp=li.querySelector('.totalPrice');const t=li.querySelector('.title a');return (t?t.textContent.trim():'?')+' | '+(tp?tp.textContent.replace(/[^0-9.]/g,''):'?');})};})()`;
  for(const u of ['co21l3rs','co21l2rs']){
    const url='https://cd.ke.com/ershoufang/'+u+encodeURIComponent('华润二十四城')+'/';
    await send('Page.navigate',{url}); await sleep(3000);
    const ok=await waitFor(`!!document.querySelector('.sellListContent > li')`,16000);
    await sleep(800);
    const info=ok?await evaluate(REPORT).catch(e=>'ERR:'+e.message):'NO_LIST';
    console.log(u,'->',JSON.stringify(info));
    await sleep(1000);
  }
  ws.close();process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
