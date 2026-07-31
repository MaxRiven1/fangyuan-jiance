// 每日巡检解析：从 beike_result.json 提取各小区 3室2厅 最低/中位价
const fs = require('fs');
const r = JSON.parse(fs.readFileSync(__dirname + '/beike_result.json', 'utf8'));

function parsePrice(s) {
  const m = String(s).match(/([\d.]+)\s*万/);
  return m ? parseFloat(m[1]) : null;
}
function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

const out = {};
for (const [id, v] of Object.entries(r)) {
  if (!v.listings) { out[id] = { name: v.name, error: v.error }; continue; }
  let items = v.listings;
  // 规则1: 和谐家园剔除远郊"东区"
  if (v.name === '和谐家园') {
    items = items.filter(it => !/东区|西区/.test(it.title + ' ' + it.position + ' ' + it.house));
  }
  // 规则2: 红枫岭只要三期
  if (v.name === '红枫岭三期') {
    items = items.filter(it => /三期/.test(it.title + ' ' + it.position + ' ' + it.house));
  }
  // 只取3室2厅
  const t3 = items.filter(it => /3室2厅/.test(it.house)).map(it => ({
    title: it.title, house: it.house, position: it.position,
    price: parsePrice(it.totalPrice), unitPrice: it.unitPrice, href: it.href
  })).filter(it => it.price);
  t3.sort((a, b) => a.price - b.price);
  out[id] = {
    name: v.name,
    在售套三数: t3.length,
    最低万: t3.length ? t3[0].price : null,
    中位万: median(t3.map(x => x.price)),
    最低三套: t3.slice(0, 3)
  };
}
fs.writeFileSync(__dirname + '/daily_stats.json', JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(out, (k, val) => k === 'href' ? undefined : val, 1));
