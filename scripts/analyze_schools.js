const fs = require('fs');
const d = require('./beike_schools_result.json');

function parseListing(it) {
  const house = it.house || '';
  const rm = house.match(/(\d+)室(\d+)厅/);
  const lm = house.match(/共(\d+)层/);
  const am = house.match(/([\d.]+)平米/);
  const ym = house.match(/(\d{4})年/);
  const priceRaw = (it.totalPrice || '').replace(/[^\d.]/g, '');
  const price = priceRaw ? parseFloat(priceRaw) : null;
  return {
    title: it.title,
    href: it.href,
    shi: rm ? +rm[1] : null,
    ting: rm ? +rm[2] : null,
    floors: lm ? +lm[1] : null,
    area: am ? parseFloat(am[1]) : null,
    year: ym ? +ym[1] : null,
    price,
    position: it.position,
    unitPrice: (it.unitPrice || '').replace(/[^\d]/g, '')
  };
}

const S3_MAX = 150, S2_MAX = 100;
const out = {};
for (const k of Object.keys(d)) {
  const e = d[k];
  if (e.error || !e.listings) { out[k] = { ...e, note: 'ERR:' + (e.error || 'no listings') }; continue; }
  const parsed = e.listings.map(parseListing).filter(x => x.shi && x.price);
  const s3 = parsed.filter(x => x.shi === 3 && x.price <= S3_MAX).sort((a,b)=>a.price-b.price);
  const s2 = parsed.filter(x => x.shi === 2 && x.price <= S2_MAX).sort((a,b)=>a.price-b.price);
  // 电梯启发式：只要有任意房源总层>=8，视为电梯楼盘
  const maxFloor = Math.max(...parsed.map(x=>x.floors||0));
  const isElevator = maxFloor >= 8;
  out[k] = {
    school: e.school, district: e.district, area: e.area, name: e.name,
    totalListings: e.listings.length,
    maxFloor, isElevator,
    s3_under150_count: s3.length,
    s3_under150_min: s3[0] ? s3[0].price : null,
    s3_under150_samples: s3.slice(0, 4).map(x => ({ p: x.price, area: x.area, floor: x.floors, href: x.href, t: x.title })),
    s2_under100_count: s2.length,
    s2_under100_min: s2[0] ? s2[0].price : null,
    s2_under100_samples: s2.slice(0, 4).map(x => ({ p: x.price, area: x.area, floor: x.floors, href: x.href, t: x.title, ting: x.ting }))
  };
}
fs.writeFileSync('schools_analysis.json', JSON.stringify(out, null, 2), 'utf8');
// 控制台可读摘要
for (const k of Object.keys(out)) {
  const o = out[k];
  if (o.note) { console.log(`[${k}] ${o.name} -> ${o.note}`); continue; }
  const s3 = o.s3_under150_count ? `套三≤150万:${o.s3_under150_count}套(最低${o.s3_under150_min}万)` : '套三≤150万:无';
  const s2 = o.s2_under100_count ? `套二≤100万:${o.s2_under100_count}套(最低${o.s2_under100_min}万)` : '套二≤100万:无';
  console.log(`[${o.school}] ${o.name} | 电梯=${o.isElevator}(最高${o.maxFloor}层) | ${s3} | ${s2}`);
}
console.log('\nSaved schools_analysis.json');
