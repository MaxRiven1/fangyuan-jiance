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
  const waitFor=async(c,t=20000)=>{const t0=Date.now();while(Date.now()-t0<t){try{if(await evaluate(c))return true;}catch(e){}await sleep(800);}return false;};
  const REPORT=`(()=>{const items=Array.from(document.querySelectorAll('.sellListContent > li'));return {url:location.href,count:items.length,first3:items.slice(0,3).map(li=>{const tp=li.querySelector('.totalPrice');const t=li.querySelector('.title a');const h=li.querySelector('.houseInfo');return (t?t.textContent.trim():'?')+' | '+(tp?tp.textContent.replace(/[^0-9.]/g,''):'?')+'万 | '+(h?h.textContent.replace(/\\s+/g,' ').trim():'');})};})()`;
  const url='https://cd.ke.com/ershoufang/l3rs'+encodeURIComponent('华润二十四城')+'/';
  await send('Page.navigate',{url}); await sleep(3000);
  await waitFor(`!!document.querySelector('.sellListContent > li')`,15000);
  console.log('BEFORE click:',JSON.stringify(await evaluate(REPORT)));
  // 点击总价
  const clicked=await evaluate(`(()=>{const a=Array.from(document.querySelectorAll('a,span,div')).find(e=>(e.textContent||'').trim()==='总价');if(!a)return 'NO';a.click();return 'CLICKED';})()`);
  console.log('click result:',clicked);
  await sleep(6000);
  console.log('AFTER click (6s):',JSON.stringify(await evaluate(REPORT)));
  ws.close();process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
