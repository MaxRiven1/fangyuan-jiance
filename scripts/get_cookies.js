const WebSocket=require('ws');const http=require('http');
const PORT=9333;
function getTargets(){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{
 const t=(await getTargets()).find(x=>x.type==='page'&&x.url.includes('ke.com'));
 const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});
 let id=0;const p={};
 const send=(m,pa)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pa}))});
 ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&p[j.id]){p[j.id](j);delete p[j.id]}});
 await new Promise(r=>ws.on('open',r));
 const r=await send('Network.getAllCookies',{});
 const cs=r.result.cookies.filter(c=>/ke\.com|lianjia/.test(c.domain));
 const names=cs.map(c=>c.name+'@'+c.domain);
 console.log('TOTAL',cs.length);
 console.log('HAS_TOKEN', names.some(n=>n.startsWith('lianjia_token')));
 console.log('HAS_UBT', names.some(n=>n.startsWith('lianjia_ssid')));
 console.log(names.join('\n'));
 ws.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
