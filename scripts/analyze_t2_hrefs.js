// 导出各候选小区 套二≤100万 房源的 href，供详情页核验卫数
const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'beike_result.json'), 'utf8'));
function num(s){const m=String(s||'').replace(/,/g,'').match(/[\d.]+/);return m?parseFloat(m[0]):null;}
function clean(l){const t=l.title||'';if(/和谐家园[东南西北]区/.test(t))return false;if(/红枫岭/.test(t)&&!/三期/.test(t))return false;return true;}
const want=['JN-001','CH-003','CH-004'];
const out={};
for(const key of Object.keys(data)){
  if(!want.includes(key))continue;
  const listings=Array.isArray(data[key])?data[key]:(data[key].listings||[]);
  const t2=listings.filter(l=>clean(l)).map(l=>{const h=l.house||'';const hm=h.match(/(\d)室(\d)厅/);const area=(h.match(/([\d.]+)平米/)||[])[1];return{title:l.title,huxing:hm?hm[0]:'',area:area?parseFloat(area):null,total:num(l.totalPrice),unit:num(l.unitPrice),href:l.href};}).filter(x=>/^2室/.test(x.huxing)&&x.total<=100);
  t2.sort((a,b)=>a.total-b.total);
  out[key]=t2;
}
fs.writeFileSync(path.join(__dirname,'t2_candidates.json'),JSON.stringify(out,null,2));
console.log('候选导出完成：');
for(const k of Object.keys(out))console.log(k, out[k].length,'套 ->', out[k].map(x=>x.total+'万').join(','));
