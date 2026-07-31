const WebSocket = require('ws');
const http = require('http');
const PORT = 9333;
function getTargets(){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej);});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const targets=await getTargets();
  const page=targets.find(t=>t.type==='page'&&(t.url.includes('ke.com')||t.url.includes('lianjia')))||targets.find(t=>t.type==='page');
  console.log('PAGE url=',page.url);
  const ws=new WebSocket(page.webSocketDebuggerUrl,{perMessageDeflate:false});
  let id=0;const pending={};
  const send=(m,p)=>new Promise((res,rej)=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method:m,params:p}));setTimeout(()=>rej(new Error('timeout '+m)),45000);});
  ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&pending[j.id]){pending[j.id](j);delete pending[j.id];}});
  await new Promise(r=>ws.on('open',r));
  const evaluate=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});if(r.result&&r.result.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,200));return r.result.result.value;};
  const waitFor=async(c,t=18000)=>{const t0=Date.now();while(Date.now()-t0<t){try{if(await evaluate(c))return true;}catch(e){}await sleep(800);}return false;};
  const EXTRACT=`(() => {
    const items = Array.from(document.querySelectorAll('.sellListContent > li'));
    const out = [];
    for (const li of items) {
      const titleEl = li.querySelector('.title a');
      const houseEl = li.querySelector('.houseInfo');
      const posEl = li.querySelector('.positionInfo');
      const tpEl = li.querySelector('.totalPrice');
      if (!titleEl || !houseEl || !tpEl) continue;
      out.push({ title: titleEl.textContent.trim(), href: titleEl.href, house: houseEl.textContent.trim().replace(/\\s+/g, ' '), position: posEl ? posEl.textContent.trim().replace(/\\s+/g, ' ') : '', totalPrice: tpEl.textContent.trim() });
    }
    return out;
  })()`;
  const c={search:'华润二十四城'};
  const room='l3';
  const url='https://cd.ke.com/ershoufang/co21'+room+'rs'+encodeURIComponent(c.search)+'/';
  console.log('NAV url=',url);
  await send('Page.navigate',{url});
  await sleep(2500);
  const ok=await waitFor(`!!document.querySelector('.sellListContent > li') || /没有找到|暂无房源/.test(document.body.innerText)`,18000);
  console.log('waitFor ok=',ok);
  const bodyTxt=await evaluate(`document.body.innerText.slice(0,80)`).catch(e=>'ERR:'+e.message);
  console.log('bodyText head=',JSON.stringify(bodyTxt));
  let data;
  try{data=await evaluate(EXTRACT);}catch(e){console.log('EXTRACT THREW:',e.message);data=[];}
  console.log('data len=',data?data.length:'(undef)');
  console.log('data[0]=',data&&data[0]?JSON.stringify(data[0]):'none');
  ws.close();process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1);});
