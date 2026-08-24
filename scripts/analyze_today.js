// 2026-08-04 巡检分析：将升序抓取数据映射到两池基线，应用清洗+已知假信号，判定候选警报
const fs = require('fs');
const asc = JSON.parse(fs.readFileSync(__dirname + '/daily_asc_result.json', 'utf8'));
const pool3 = JSON.parse(fs.readFileSync(__dirname + '/../数据/小区池.json', 'utf8'));
const pool2 = JSON.parse(fs.readFileSync(__dirname + '/../数据/小区池_套二.json', 'utf8'));

const num = s => { const m = String(s || '').match(/([\d.]+)/); return m ? parseFloat(m[1]) : null; };
const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

// 清洗：和谐东区/西区、红枫岭仅三期、单价<8000
function clean(name, it) {
  const t = (it.title || '') + ' ' + (it.position || '');
  if (name.includes('和谐家园') && /东区|西区/.test(t)) return false;
  if (name.includes('红枫岭') && !t.includes('三期')) return false;
  const unit = num((it.unitPrice || '').replace(/,/g, ''));
  if (unit && unit < 8000) return false;
  return true;
}

// 已知套三单卫(1卫)假信号：以 (面积±1㎡, 价格±2万) 签名匹配，抓取时排除
const KNOWN_1WEI = {
  'CH-002': [{area:69.31, price:90},{area:69.31, price:95},{area:69.31, price:98.5}],
  'JN-001': [{area:94.41, price:135},{area:119.02, price:170}],
  'JN-002a': [{area:86.28, price:148},{area:86.28, price:158}],
  'JN-003': [{area:85.05, price:136},{area:86.69, price:133}],
};
function isKnown1wei(id, it) {
  const sigs = KNOWN_1WEI[id] || [];
  const am = (it.house || '').match(/([\d.]+)平米/);
  const area = am ? parseFloat(am[1]) : null;
  const price = num(it.totalPrice);
  return sigs.some(s => area && Math.abs(area - s.area) < 1 && Math.abs(price - s.price) < 2);
}

// 建立 id -> 池记录 映射（套三池 & 套二池，按小区名/搜索词对齐）
const p3byName = {}; pool3['小区池'].forEach(c => p3byName[c.小区] = c);
const p2byName = {}; pool2['小区池'].forEach(c => p2byName[c.小区] = c);
// 蓝光凯丽豪景/云鼎 同属 JN-002 池
const p3byId = {
  'JN-001': p3byName['和谐家园'],
  'CH-001': p3byName['红枫岭三期'],
  'CH-002': p3byName['蓝润V客尚东'],
  'CH-003': p3byName['和泓·东28'],
  'CH-004': p3byName['鼎城上都'],
  'JN-002a': p3byName['蓝光凯丽豪景/蓝光云鼎'],
  'JN-002b': p3byName['蓝光凯丽豪景/蓝光云鼎'],
  'JN-003': p3byName['中加水岸'],
  'QY-001': p3byName['万科金色领域'],
  'QY-002': p3byName['清溪雅筑'],
};
const p2byId = {
  'JN-001': p2byName['和谐家园'],
  'CH-003': p2byName['和泓·东28'],
  'CH-004': p2byName['鼎城上都'],
  'CH-005': p2byName['花样年花郡'],
  'QY-003': p2byName['时代凯悦'],
  'JN-004': p2byName['西城天下'],
};

const report = { 套三: [], 套二: [], 候选警报: [] };

for (const [id, v] of Object.entries(asc)) {
  const parse = arr => (arr || []).filter(it => clean(v.name, it)).map(it => {
    const hm = (it.house || '').match(/(\d)室(\d)厅/);
    const am = (it.house || '').match(/([\d.]+)平米/);
    return { huxing: hm ? hm[0] : '', area: am ? parseFloat(am[1]) : null, price: num(it.totalPrice), unit: (it.unitPrice || '').replace(/,/g, ''), house: it.house, href: it.href, title: it.title };
  }).filter(x => x.price).sort((a, b) => a.price - b.price);

  const l3 = parse(v.l3);
  const l2 = parse(v.l2);
  const t3 = l3.filter(x => /^3室2厅/.test(x.huxing));
  const t2 = l2.filter(x => /^2室/.test(x.huxing));
  const t2le = t2.filter(x => x.price <= 100);

  // 套三：cleaned 双卫 lowest = 排除已知1卫后最低
  const t3_clean = t3.filter(x => !isKnown1wei(id, x));
  const 双卫候选 = t3_clean.length ? t3_clean[0] : null;

  // 套二 lowest（≤100万）
  const 套二候选 = t2le.length ? t2le[0] : (t2.length ? t2[0] : null);

  // --- 套三比对 ---
  const p3 = p3byId[id];
  if (p3 && p3['双卫最低总价万'] != null && 双卫候选) {
    const base = p3['双卫最低总价万'];
    const drop = (base - 双卫候选.price) / base;
    const rec = { id, 小区: v.name, 基线双卫最低万: base, 当日双卫候选万: 双卫候选.price, 跌幅: +(drop*100).toFixed(1)+'%', 候选户型: 双卫候选.huxing, 面积: 双卫候选.area, href: 双卫候选.href, 套三3室2厅数: t3.length, 套三中位万: median(t3.map(x=>x.price)), 备注: (isKnown1wei(id, t3[0]||{}) ? '最低为已知1卫假信号已剔除' : '') };
    // 特殊规则
    let alert = null;
    if (drop > 0.10) alert = `套三最低相对双卫基线跌超10%`;
    if (id === 'QY-001' && 双卫候选.price <= 150) alert = '万科金色领域≤150万套三双卫';
    if ((id === 'JN-001' || id === 'JN-002b') && 双卫候选.price <= 150) alert = '和谐家园/蓝光云鼎双卫跌入150万内';
    if (id === 'CH-001' && 双卫候选.price < 120) alert = '红枫岭三期<120万套三';
    rec.警报 = alert;
    if (alert) report.候选警报.push({ 类型:'套三', ...rec });
    report.套三.push(rec);
  } else if (p3 && p3['双卫最低总价万'] == null) {
    // 无确认双卫（清溪雅筑/和泓东28）：仅记录套三最低(单卫)
    const lo = t3.length ? t3[0] : null;
    report.套三.push({ id, 小区: v.name, 基线双卫最低万: null, 当日套三最低万: lo?lo.price:null, 套三3室2厅数: t3.length, 套三中位万: median(t3.map(x=>x.price)), 备注: '无确认双卫，最低为单卫价' });
  }

  // --- 套二比对 ---
  const p2 = p2byId[id];
  if (p2 && 套二候选) {
    const base = p2['套二单卫最低总价万'];
    const drop = (base - 套二候选.price) / base;
    const rec = { id, 小区: v.name, 基线套二单卫最低万: base, 当日套二le100最低万: 套二候选.price, 跌幅: +(drop*100).toFixed(1)+'%', 候选户型: 套二候选.huxing, 面积: 套二候选.area, href: 套二候选.href, 套二数: t2.length, 套二le100数: t2le.length, 套二中位万: median(t2.map(x=>x.price)) };
    let alert = null;
    if (drop > 0.10) alert = '套二≤100万最低价相对基线跌超10%';
    rec.警报 = alert;
    if (alert) report.候选警报.push({ 类型:'套二', ...rec });
    report.套二.push(rec);
  }
}

fs.writeFileSync(__dirname + '/today_report.json', JSON.stringify(report, null, 2), 'utf8');
console.log('=== 套三 ===');
report.套三.forEach(r => console.log(`  ${r.小区}: 基线${r.基线双卫最低万 ?? '无'} → 当日${r.当日双卫候选万 ?? r.当日套三最低万}万 (${r.跌幅 ?? '-'}) 套三n=${r.套三3室2厅数} 中位=${r.套三中位万} ${r.警报?'⚠️'+r.警报:''}`));
console.log('=== 套二 ===');
report.套二.forEach(r => console.log(`  ${r.小区}: 基线${r.基线套二单卫最低万} → 当日${r.当日套二le100最低万}万 (${r.跌幅}) 套二n=${r.套二数} le100=${r.套二le100数} 中位=${r.套二中位万} ${r.警报?'⚠️'+r.警报:''}`));
console.log('=== 候选警报数: ' + report.候选警报.length + ' ===');
report.候选警报.forEach(a => console.log(`  [${a.类型}] ${a.小区} ${a.警报} | ${a.href}`));
