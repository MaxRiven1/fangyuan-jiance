const fs = require('fs');
const d = require('./beike_rooms_result.json');
const S3_MAX = 150, S2_MAX = 100;

function parse(it) {
  const house = it.house || '';
  const rm = house.match(/(\d+)室(\d+)厅/);
  const lm = house.match(/共(\d+)层/);
  const am = house.match(/([\d.]+)平米/);
  const price = parseFloat((it.totalPrice || '').replace(/[^\d.]/g, ''));
  return { title: it.title, href: it.href, shi: rm ? +rm[1] : null, ting: rm ? +rm[2] : null, floors: lm ? +lm[1] : null, area: am ? parseFloat(am[1]) : null, price, position: it.position };
}

const summary = {};
const verifyInput = [];
for (const k of Object.keys(d)) {
  const e = d[k];
  const s3 = (e.l3 || e.s3 || []).map(parse).filter(x => x.shi === 3 && x.price);
  const s2 = (e.l2 || e.s2 || []).map(parse).filter(x => x.shi === 2 && x.price);
  const maxFloor = Math.max(0, ...s3.map(x => x.floors || 0), ...s2.map(x => x.floors || 0));
  const isElevator = maxFloor >= 8;
  const s3u = s3.filter(x => x.price <= S3_MAX).sort((a, b) => a.price - b.price);
  const s2u = s2.filter(x => x.price <= S2_MAX).sort((a, b) => a.price - b.price);
  summary[k] = {
    school: e.school, district: e.district, name: e.name,
    isElevator, maxFloor,
    s3_count: s3.length, s3_min: s3[0] ? s3[0].price : null,
    s3_min_area: s3[0] ? s3[0].area : null,
    s2_count: s2.length, s2_min: s2[0] ? s2[0].price : null,
    s2_min_area: s2[0] ? s2[0].area : null,
    s3_under150: s3u.length, s2_under100: s2u.length
  };
  // 验证输入：预算内套三取最便宜1套核验双卫+电梯；预算内套二取最便宜1套核验单卫/双卫+电梯
  if (s3u.length) verifyInput.push({ id: k + '_s3', url: s3u[0].href, type: 's3', school: e.school, name: e.name, price: s3u[0].price });
  if (s2u.length) verifyInput.push({ id: k + '_s2', url: s2u[0].href, type: 's2', school: e.school, name: e.name, price: s2u[0].price });
}

fs.writeFileSync('verify_input.json', JSON.stringify(verifyInput, null, 2), 'utf8');
console.log('--- 各小区 套三/套二 最低价（贝壳价格升序，已排除车位）---');
for (const k of Object.keys(summary)) {
  const o = summary[k];
  console.log(`[${o.school}] ${o.name} | 电梯=${o.isElevator}(≤${o.maxFloor}层) | 套三:${o.s3_count}套 最低${o.s3_min}万(${o.s3_min_area}㎡) 预算内${o.s3_under150} | 套二:${o.s2_count}套 最低${o.s2_min}万(${o.s2_min_area}㎡) 预算内${o.s2_under100}`);
}
console.log('\n需核验房源数: ' + verifyInput.length + ' (verify_input.json)');
fs.writeFileSync('rooms_summary.json', JSON.stringify(summary, null, 2), 'utf8');
