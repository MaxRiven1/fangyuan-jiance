const http=require('http');
http.get('http://127.0.0.1:9333/json/list',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const a=JSON.parse(d);console.log('OK targets='+a.length);a.slice(0,5).forEach(t=>console.log(' -',t.type,'|',t.url));}catch(e){console.log('PARSE FAIL',d.slice(0,120));}});}).on('error',e=>console.log('DOWN',e.message));
