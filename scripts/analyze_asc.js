// 解析价格升序抓取结果：输出各小区 3室2厅(套三) / 2室(套二) 的真实最低价与清单
const fs = require('fs');
const r = JSON.parse(fs.readFileSync(__dirname + '/daily_asc_result.json', 'utf8'));

const num = s => { const m = String(s || '').match(/([\d.]+)/); return m ? parseFloat(m[1]) : null; };
const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

// 清洗规则
function clean(name, it) {
  const t = (it.title || '') + ' ' + (it.position || '');
  if (name.includes('和谐家园') && /东区|西区/.test(t)) return false;      // 剔除远郊同名
  if (name.includes('红枫岭') && !t.includes('三期')) return false;        // 只统计三期
  const unit = num((it.unitPrice || '').replace(/,/g, ''));
  if (unit && unit < 8000) return false;                                    // 单价过低=远郊同名/异常错录
  return true;
}

const out = {};
for (const [id, v] of Object.entries(r)) {
  const parse = arr => (arr || []).filter(it => clean(v.name, it)).map(it => {
    const hm = (it.house || '').match(/(\d)室(\d)厅/);
    const am = (it.house || '').match(/([\d.]+)平米/);
    return { huxing: hm ? hm[0] : '', area: am ? parseFloat(am[1]) : null, price: num(it.totalPrice), unit: (it.unitPrice || '').replace(/,/g, ''), house: it.house, href: it.href };
  }).filter(x => x.price).sort((a, b) => a.price - b.price);

  const l3 = parse(v.l3);
  const l2 = parse(v.l2);
  const t3 = l3.filter(x => /^3室2厅/.test(x.huxing));       // 套三口径=3室2厅
  const t2 = l2.filter(x => /^2室/.test(x.huxing));
  const t2le = t2.filter(x => x.price <= 100);
  out[id] = {
    name: v.name,
    套三3室2厅数: t3.length, 套三最低: t3.length ? t3[0].price : null, 套三中位: median(t3.map(x => x.price)),
    套三最低5: t3.slice(0, 5),
    套二数: t2.length, 套二le100数: t2le.length, 套二最低: t2le.length ? t2le[0].price : (t2.length ? t2[0].price : null),
    套二le100中位: median(t2le.map(x => x.price)), 套二中位: median(t2.map(x => x.price)),
    套二le100清单: t2le,
    l3原始数: (v.l3 || []).length, l2原始数: (v.l2 || []).length
  };
}
fs.writeFileSync(__dirname + '/daily_asc_stats.json', JSON.stringify(out, null, 2), 'utf8');
for (const [id, v] of Object.entries(out)) {
  console.log(`=== ${id} ${v.name} | 套三(3室2厅) n=${v.套三3室2厅数} 最低=${v.套三最低} 中位=${v.套三中位} | 套二 n=${v.套二数} le100=${v.套二le100数} 最低=${v.套二最低}`);
  v.套三最低5.forEach(x => console.log(`   [3] ${x.price}万 ${x.area}㎡ ${x.house} ${x.href}`));
  v.套二le100清单.forEach(x => console.log(`   [2] ${x.price}万 ${x.area}㎡ ${x.house} ${x.href}`));
}
