const WebSocket=require('ws');const http=require('http');const fs=require('fs');
const PORT=9333;const OUT=process.argv[2]||'shot.png';
function gt(){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{
 const t=(await gt()).find(x=>x.type==='page'&&x.url.includes('ke.com'));
 const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false,maxPayload:200*1024*1024});
 let id=0;const p={};
 const send=(m,pa)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pa}))});
 ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&p[j.id]){p[j.id](j);delete p[j.id]}});
 await new Promise(r=>ws.on('open',r));
 const r=await send('Page.captureScreenshot',{format:'png'});
 fs.writeFileSync(OUT,Buffer.from(r.result.data,'base64'));
 console.log('saved',OUT);
 ws.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
