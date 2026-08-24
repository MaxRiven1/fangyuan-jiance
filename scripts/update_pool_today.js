// 2026-08-04 写回价格历史：套三池 + 套二池
const fs = require('fs');
const asc = JSON.parse(fs.readFileSync(__dirname + '/daily_asc_result.json', 'utf8'));
const TODAY = '2026-08-04';

const num = s => { const m = String(s || '').match(/([\d.]+)/); return m ? parseFloat(m[1]) : null; };
const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

function clean(name, it) {
  const t = (it.title || '') + ' ' + (it.position || '');
  if (name.includes('和谐家园') && /东区|西区/.test(t)) return false;
  if (name.includes('红枫岭') && !t.includes('三期')) return false;
  const unit = num((it.unitPrice || '').replace(/,/g, ''));
  if (unit && unit < 8000) return false;
  return true;
}
const parse = (name, arr) => (arr || []).filter(it => clean(name, it)).map(it => {
  const hm = (it.house || '').match(/(\d)室(\d)厅/);
  const am = (it.house || '').match(/([\d.]+)平米/);
  return { huxing: hm ? hm[0] : '', area: am ? parseFloat(am[1]) : null, price: num(it.totalPrice), href: it.href };
}).filter(x => x.price);

// 经详情页核验的"双卫最低万"真值（排除已知1卫假信号 135/170/90/148/133 等）
const VALID_双卫 = {
  'CH-001': 120, 'CH-004': 128, 'CH-002': 128, 'QY-001': 155,
  'JN-001': 178, 'JN-002': 168, 'JN-003': 144, 'QY-002': null, 'CH-003': null
};
const VALID_套二 = {
  'JN-001': 96, 'CH-003': 78, 'CH-004': 82, 'CH-005': 96, 'QY-003': 77, 'JN-004': 97.2
};
// asc id -> 套三池 key (JN-002 合并 凯丽豪景+云鼎)
const P3 = {
  'CH-001': 'CH-001', 'CH-004': 'CH-004', 'CH-002': 'CH-002', 'QY-001': 'QY-001',
  'JN-001': 'JN-001', 'JN-002a': 'JN-002', 'JN-002b': 'JN-002', 'JN-003': 'JN-003',
  'QY-002': 'QY-002', 'CH-003': 'CH-003'
};
const P2 = { 'JN-001': 'JN-001', 'CH-003': 'CH-003', 'CH-004': 'CH-004', 'CH-005': 'CH-005', 'QY-003': 'QY-003', 'JN-004': 'JN-004' };

// 聚合 asc 数据
const agg = {};
for (const [id, v] of Object.entries(asc)) {
  const l3 = parse(v.name, v.l3).filter(x => /^3室2厅/.test(x.huxing));
  const l2 = parse(v.name, v.l2).filter(x => /^2室/.test(x.huxing));
  const l2le = l2.filter(x => x.price <= 100);
  const k3 = P3[id], k2 = P2[id];
  if (k3) { (agg[k3] = agg[k3] || { t3: [], t2: [], t2le: [] }).t3.push(...l3); }
  if (k2) { (agg[k2] = agg[k2] || { t3: [], t2: [], t2le: [] }).t2.push(...l2); agg[k2].t2le.push(...l2le); }
}

function appendHistory(poolFile, idField, idMap, validatedLow, isT3) {
  const p = JSON.parse(fs.readFileSync(poolFile, 'utf8'));
  const lowField = isT3 ? '双卫最低万' : '套二单卫最低万';
  for (const c of p['小区池']) {
    const key = idMap[c.id];
    if (!key || !agg[key]) continue;
    const a = agg[key];
    const last = c['价格历史'][c['价格历史'].length - 1];
    const lastIsToday = last && last['日期'] === TODAY;
    // 去重：今日条目已含有效低价字段则跳过；若为上一轮bug残留（缺失低价字段）则重写
    const hasValidLow = (last && last[lowField] != null && last[lowField] !== 'undefined') || (isT3 && last && last['套三最低万'] != null);
    if (lastIsToday && hasValidLow) continue;
    let entry;
    if (isT3) {
      if (validatedLow[key] == null) {
        const lo = a.t3.length ? Math.min(...a.t3.map(x => x.price)) : null;
        entry = { 日期: TODAY, 套三最低万: lo, 套三中位万: median(a.t3.map(x => x.price)), 在售套三数: a.t3.length, 来源: '贝壳登录抓取', 备注: '无确认双卫，最低为单卫价' };
      } else {
        entry = { 日期: TODAY, 双卫最低万: validatedLow[key], 套三中位万: median(a.t3.map(x => x.price)), 在售套三数: a.t3.length, 来源: '贝壳登录抓取', 备注: `${validatedLow[key]}万为详情页核验双卫最低（排除当日低价1卫假信号）` };
      }
    } else {
      entry = { 日期: TODAY, 套二单卫最低万: validatedLow[key], 套二中位万: median(a.t2le.map(x => x.price)), 在售套二数: a.t2.length, 在售套二le100数: a.t2le.length, 来源: '贝壳登录抓取', 备注: `${validatedLow[key]}万为≤100万最低（与基线持平）` };
    }
    // 今日条目已存在（bug残留）则替换，否则追加
    if (lastIsToday) c['价格历史'][c['价格历史'].length - 1] = entry;
    else c['价格历史'].push(entry);
    if (isT3 && validatedLow[key] != null) c['双卫最低总价万'] = validatedLow[key];
  }
  fs.writeFileSync(poolFile, JSON.stringify(p, null, 2), 'utf8');
}

// 套三池
appendHistory(__dirname + '/../数据/小区池.json', 'id',
  { 'CH-001':'CH-001','CH-004':'CH-004','CH-002':'CH-002','QY-001':'QY-001','JN-001':'JN-001','JN-002':'JN-002','JN-003':'JN-003','QY-002':'QY-002','CH-003':'CH-003' },
  VALID_双卫, true);
// 套二池
appendHistory(__dirname + '/../数据/小区池_套二.json', 'id',
  { 'T2-JN-001':'JN-001','T2-CH-003':'CH-003','T2-CH-004':'CH-004','T2-CH-005':'CH-005','T2-QY-005':'QY-003','T2-JN-005':'JN-004' },
  VALID_套二, false);

console.log('价格历史已写回两池 (日期 ' + TODAY + ')');
// 打印摘要
const p3 = JSON.parse(fs.readFileSync(__dirname + '/../数据/小区池.json', 'utf8'));
const p2 = JSON.parse(fs.readFileSync(__dirname + '/../数据/小区池_套二.json', 'utf8'));
console.log('--- 套三池 ---');
p3['小区池'].forEach(c => { const e = c['价格历史'][c['价格历史'].length-1]; console.log(`  ${c.小区}: ${e['双卫最低万']!=null?('双卫'+e['双卫最低万']+'万'):('套三最低'+e['套三最低万']+'万')} 中位${e['套三中位万']} 在售${e['在售套三数']}`); });
console.log('--- 套二池 ---');
p2['小区池'].forEach(c => { const e = c['价格历史'][c['价格历史'].length-1]; console.log(`  ${c.小区}: 套二单卫最低${e['套二单卫最低万']}万 中位${e['套二中位万']} 在售${e['在售套二数']} le100=${e['在售套二le100数']}`); });
