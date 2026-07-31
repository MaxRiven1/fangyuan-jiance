// 分析贝壳登录抓取结果，提取各小区 套二(2室) ≤100万 房源，作为套二单卫监控池的真实基线
const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'beike_result.json'), 'utf8'));

function num(s) { const m = String(s || '').replace(/,/g, '').match(/[\d.]+/); return m ? parseFloat(m[0]) : null; }

// 清洗规则（与套三监测一致）
function clean(name, l) {
  const title = (l.title || '') + ' ' + (l.position || '');
  if (name.includes('和谐家园') && /东区|西区/.test(title)) return false; // 剔除远郊同名盘（东区/西区）
  if (name.includes('红枫岭') && !title.includes('三期')) return false;   // 只统计三期
  return true;
}

const out = [];
for (const key of Object.keys(data)) {
  const name = (data[key] && data[key].name) || key; // 注意：key是小区池id(如JN-001)，清洗必须用小区名
  const listings = Array.isArray(data[key]) ? data[key] : (data[key].listings || []);
  const parsed = listings
    .filter(l => clean(name, l))
    .map(l => {
      const house = l.house || '';
      const hm = house.match(/(\d)室(\d)厅/);
      const huxing = hm ? hm[0] : '';
      const am = house.match(/([\d.]+)平米/);
      const area = am ? parseFloat(am[1]) : null;
      const total = num(l.totalPrice);
      const unit = num(l.unitPrice);
      return { title: l.title, huxing, area, total, unit, href: l.href, position: l.position || '' };
    })
    .filter(x => x.total);

  const t2 = parsed.filter(x => /^2室/.test(x.huxing));
  const t2le100 = t2.filter(x => x.total <= 100);
  const stat = arr => {
    if (!arr.length) return null;
    const totals = arr.map(x => x.total).sort((a, b) => a - b);
    const units = arr.map(x => x.unit).filter(Boolean).sort((a, b) => a - b);
    const med = a => a.length ? a[Math.floor(a.length / 2)] : null;
    return { count: arr.length, min: totals[0], max: totals[totals.length - 1], median: med(totals), medianUnit: med(units) };
  };
  out.push({
    community: key,
    总在售: parsed.length,
    套二在售: t2.length,
    套二le100: stat(t2le100),
    套二全部: stat(t2),
    套二le100样本: t2le100.slice(0, 15).map(x => `${x.huxing} ${x.area}㎡ ${x.total}万(${x.unit}元/㎡) ${x.title.slice(0, 24)}`)
  });
}
console.log(JSON.stringify(out, null, 2));
