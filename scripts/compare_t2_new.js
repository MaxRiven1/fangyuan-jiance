// 对比今日≤100万套二 与 7-28基线候选清单(t2_candidates.json)，找新上架
const fs=require('fs');
const base=JSON.parse(fs.readFileSync('t2_candidates.json','utf8'));
const data=JSON.parse(fs.readFileSync('beike_result.json','utf8'));
const num=s=>{const m=String(s||'').replace(/,/g,'').match(/[\d.]+/);return m?parseFloat(m[0]):null;};
const map={'JN-001':'和谐家园','CH-003':'和泓东28','CH-004':'鼎城上都'};
for(const [id,name] of Object.entries(map)){
  const listings=(data[id]&&data[id].listings)||[];
  const t2=listings.filter(l=>{
    const t=(l.title||'')+' '+(l.position||'');
    if(name==='和谐家园'&&/东区|西区/.test(t))return false;
    return /2室[12]厅/.test(l.house||'') && num(l.totalPrice)<=100;
  }).map(l=>({title:l.title,house:(l.house||'').replace(/\s+/g,' '),total:num(l.totalPrice),href:l.href}));
  const baseHrefs=new Set((base[id]||[]).map(x=>x.href));
  const news=t2.filter(x=>!baseHrefs.has(x.href));
  const gone=(base[id]||[]).filter(x=>!t2.some(y=>y.href===x.href));
  console.log('=== '+name+' 今日≤100万套二 '+t2.length+' 套, 新上架 '+news.length+' 套, 下架 '+gone.length+' 套');
  news.forEach(x=>console.log('  [新] '+x.total+'万 '+x.house+' '+x.href));
  gone.forEach(x=>console.log('  [下架] '+x.total+'万 '+x.area+'㎡ '+x.href));
}
