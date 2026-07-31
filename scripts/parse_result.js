// 解析贝壳登录抓取结果，统计各小区套三(3室2厅)价格基线
const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'beike_result.json'), 'utf8'));

function num(s) { const m = String(s || '').replace(/,/g, '').match(/[\d.]+/); return m ? parseFloat(m[0]) : null; }

const out = [];
for (const key of Object.keys(data)) {
  const listings = Array.isArray(data[key]) ? data[key] : (data[key].listings || []);
  const parsed = listings.map(l => {
    const house = l.house || '';
    const hm = house.match(/(\d)室(\d)厅/);
    const huxing = hm ? hm[0] : '';
    const am = house.match(/([\d.]+)平米/);
    const area = am ? parseFloat(am[1]) : null;
    return {
      title: l.title,
      huxing,
      area,
      total: num(l.totalPrice),
      unit: num(l.unitPrice),
      house,
      position: l.position || ''
    };
  }).filter(x => x.total);

  const t3 = parsed.filter(x => /^3室/.test(x.huxing));
  const t32 = parsed.filter(x => /^3室2厅/.test(x.huxing));
  const stat = arr => {
    if (!arr.length) return null;
    const totals = arr.map(x => x.total).sort((a, b) => a - b);
    const units = arr.map(x => x.unit).filter(Boolean).sort((a, b) => a - b);
    const med = a => a.length ? a[Math.floor(a.length / 2)] : null;
    return { count: arr.length, min: totals[0], max: totals[totals.length - 1], median: med(totals), medianUnit: med(units) };
  };
  out.push({
    community: key,
    total_listings: parsed.length,
    stat_3room: stat(t3),
    stat_3r2t: stat(t32),
    samples_3room: t3.slice(0, 12).map(x => `${x.huxing} ${x.area}㎡ ${x.total}万 (${x.unit}元/㎡) ${x.title.slice(0, 30)}`)
  });
}
console.log(JSON.stringify(out, null, 2));
