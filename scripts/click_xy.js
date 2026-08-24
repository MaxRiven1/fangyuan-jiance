const WebSocket=require('ws');const http=require('http');
const PORT=9333;const X=+process.argv[2],Y=+process.argv[3];
function gt(){return new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
(async()=>{
 const t=(await gt()).find(x=>x.type==='page'&&x.url.includes('ke.com'));
 const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});
 let id=0;const p={};
 const send=(m,pa)=>new Promise(r=>{const i=++id;p[i]=r;ws.send(JSON.stringify({id:i,method:m,params:pa}))});
 ws.on('message',m=>{const j=JSON.parse(m);if(j.id&&p[j.id]){p[j.id](j);delete p[j.id]}});
 await new Promise(r=>ws.on('open',r));
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:X,y:Y,button:'none',clickCount:0});
 await new Promise(r=>setTimeout(r,120));
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:X,y:Y,button:'left',clickCount:1});
 await new Promise(r=>setTimeout(r,60));
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:X,y:Y,button:'left',clickCount:1});
 console.log('clicked',X,Y);
 ws.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
