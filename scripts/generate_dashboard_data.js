// 房源监测看板数据生成脚本
// 用途：每日9AM自动化拉取后运行，生成dashboard-data.json
// 用法：node generate_dashboard_data.js [日期:2026-07-31]
//
// 从学区房监测/数据/小区池.json & 小区池_套二.json 读取最新价格
// 计算近7日均价、价格变动百分比、>20%标记
// 输出到 房源监测/data/dashboard-data.json

const fs = require('fs');
const path = require('path');

// === 路径 ===
const POOL_DIR = path.resolve(__dirname, '../../学区房监测/数据');
const POOL_S3 = path.join(POOL_DIR, '小区池.json');
const POOL_S2 = path.join(POOL_DIR, '小区池_套二.json');
const COORDS_FILE = path.join(__dirname, '../data/coordinates.json');
const OUT_FILE = path.join(__dirname, '../data/dashboard-data.json');

// === 学校坐标（手动维护，Web搜索获取） ===
const SCHOOL_COORDS = {
  'syxx':   { name:'成都市实验小学', district:'青羊区', lng:104.0642,lat:30.6635, address:'人民中路一段22号' },
  'ptxx':   { name:'成都市泡桐树小学', district:'青羊区', lng:104.058,lat:30.665, address:'支矶石街8号' },
  'dcgxx':  { name:'成都市东城根街小学', district:'青羊区', lng:104.065,lat:30.665, address:'老东城根街9号' },
  'sxxx':   { name:'成都市胜西小学', district:'青羊区', lng:104.0537,lat:30.6601, address:'横小南街11号' },
  'scxx':   { name:'成都市少城小学', district:'青羊区', lng:104.0541,lat:30.6616, address:'西胜街1号' },
  'ctxx':   { name:'成都市草堂小学', district:'青羊区', lng:104.04,lat:30.66, address:'草堂片区' },
  'jsxx':   { name:'成都市金沙小学', district:'青羊区', lng:104.00,lat:30.675, address:'金阳路90号' },
  'rmblxx': { name:'成都市人民北路小学', district:'金牛区', lng:104.074,lat:30.688, address:'人民北路' },
  'ssjxx':  { name:'成都市石笋街小学', district:'金牛区', lng:104.06,lat:30.68, address:'花牌坊片区' },
  'cdzxx':  { name:'成都市茶店子小学', district:'金牛区', lng:104.0159,lat:30.6964, address:'育德路39号' },
  'ssxx':   { name:'成都市石室小学', district:'成华区', lng:104.11,lat:30.65, address:'双桥子片区' },
  'slxx':   { name:'成都市双林小学', district:'成华区', lng:104.10,lat:30.66, address:'双林路' },
  'chxx':   { name:'成都市成华小学', district:'成华区', lng:104.10,lat:30.663, address:'建设路片区' },
  'jslxx':  { name:'成都市建设路小学', district:'成华区', lng:104.105,lat:30.656, address:'建设路' },
};

// === 社区坐标（手动维护，贝壳搜索结果附近） ===
const COMM_COORDS = {
  '红枫岭三期':         { lng:104.110, lat:30.654 },
  '鼎城上都':           { lng:104.108, lat:30.655 },
  '蓝润V客尚东':        { lng:104.112, lat:30.658 },
  '万科金色领域':        { lng:104.010, lat:30.680 },
  '和谐家园':           { lng:104.016, lat:30.695 },
  '蓝光凯丽豪景/云鼎':   { lng:104.058, lat:30.682 },
  '中加水岸':           { lng:104.040, lat:30.710 },
  '清溪雅筑':           { lng:104.008, lat:30.678 },
  '和泓东28':           { lng:104.107, lat:30.657 },
  '花样年花郡':         { lng:104.100, lat:30.662 },
  '时代凯悦':           { lng:104.065, lat:30.667 },
  '西城天下':           { lng:104.015, lat:30.697 },
};

// === 主逻辑 ===
function main(dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  console.log('生成看板数据 → 日期:', date);

  // 读取两本池
  if (!fs.existsSync(POOL_S3)) { console.error('找不到 小区池.json'); return; }
  if (!fs.existsSync(POOL_S2)) { console.error('找不到 小区池_套二.json'); return; }

  const poolS3 = JSON.parse(fs.readFileSync(POOL_S3, 'utf8'));
  const poolS2 = JSON.parse(fs.readFileSync(POOL_S2, 'utf8'));

  const schoolsArr = Object.values(SCHOOL_COORDS);
  const communities = [];
  const EXCLUDED = ['中加水岸', '蓝润V客尚东']; // 14校范围外

  // --- 处理套三池 ---
  for (const entry of poolS3['小区池'] || []) {
    const cName = entry['小区'] || '';
    if (EXCLUDED.includes(cName)) { console.log(' 跳过(非14校):', cName); continue; }
    const ph = entry['价格历史'] || [];
    const recent7 = ph.slice(-7);
    const avg = recent7.reduce((s, x) => s + (x['双卫最低万'] || x['套三最低万'] || 0), 0) / (recent7.length || 1);
    const current = entry['双卫最低总价万'] || entry['基线总价万'] || 0;
    const baseline = entry['基线总价万'] || current;
    const pctChange = avg ? ((current - avg) / avg * 100) : 0;

    let status = 'ok', statusText = '达标';
    if (!entry['双卫最低总价万'] && entry['状态'] && entry['状态'].includes('剔除')) { status = 'alert'; statusText = '无双卫·剔除'; }
    else if ((current || 0) > 150 && status !== 'alert') { status = 'warn'; statusText = '超预算'; }
    if (current > 150 + 20) { status = 'alert'; statusText = '严重超预算'; }

    const coords = COMM_COORDS[cName] || { lng: 104.06, lat: 30.67 };

    communities.push({
      name: cName,
      district: entry['区'] || '',
      pool: '套三',
      lng: coords.lng, lat: coords.lat,
      school: (entry['学校'] || entry['对口学校'] || '').replace('本部',''),
      schoolLevel: entry['学校档位'] || '',
      layout: (entry['目标��型'] || '').replace(/（.*/, '').trim(),
      area: parseFloat(((entry['在售双卫样本']||entry['在售套二样本']||[])[0]||'').match(/(\d+\.?\d*)㎡/) || [null, null])[1] || null,
      elevator: !!entry['电梯'],
      currentPrice: current,
      baselinePrice: baseline,
      price7dAvg: parseFloat(avg.toFixed(2)),
      priceChange: parseFloat((current - avg).toFixed(2)),
      priceChangePct: parseFloat(pctChange.toFixed(2)),
      statusText: statusText,
      status: status,
      daysCount: recent7.length,
      note: (entry['预算可行性'] || '').replace(/（.*$/, '').trim().substring(0, 40)
    });
  }

  // --- 处理套二池 ---
  for (const entry of poolS2['小区池'] || []) {
    const ph = entry['价格历史'] || [];
    const recent7 = ph.slice(-7);
    const current = entry['套二单卫最低总价万'] || entry['基线总价万'] || 0;
    const avg = recent7.reduce((s, x) => s + (x['套二单卫最低万'] || 0), 0) / (recent7.length || 1);
    const baseline = entry['基线总价万'] || current;
    const pctChange = avg ? ((current - avg) / avg * 100) : 0;

    let status = 'ok', statusText = '达标';
    if ((current || 0) > 100) { status = 'warn'; statusText = '超预算'; }
    if (current > 100 + 10) { status = 'alert'; statusText = '严重超预算'; }

    const cName = entry['小区'] || '';
    const coords = COMM_COORDS[cName] || { lng: 104.06, lat: 30.67 };

    communities.push({
      name: cName,
      district: entry['区'] || '',
      pool: '套二',
      lng: coords.lng, lat: coords.lat,
      school: (entry['对口学校'] || '').replace('本部',''),
      schoolLevel: entry['学校档位'] || '',
      layout: (entry['目标户型'] || '').replace(/（.*/, '').trim(),
      area: parseFloat(((entry['在售套二样本']||[])[0]||'').match(/(\d+\.?\d*)㎡/) || [null, null])[1] || null,
      elevator: !!entry['电梯'],
      currentPrice: current,
      baselinePrice: baseline,
      price7dAvg: parseFloat(avg.toFixed(2)),
      priceChange: parseFloat((current - avg).toFixed(2)),
      priceChangePct: parseFloat(pctChange.toFixed(2)),
      statusText: statusText,
      status: status,
      daysCount: recent7.length,
      note: (entry['预算可行性'] || '').replace(/（.*$/, '').trim().substring(0, 40)
    });
  }

  // 各区汇总
  const districtSummary = {};
  for (const d of ['金牛区','青羊区','成华区']) {
    const list = communities.filter(c => c.district === d);
    districtSummary[d] = {
      communityCount: list.length,
      lowestPrice: Math.min(...list.map(c => c.currentPrice || 999)),
      highestPrice: Math.max(...list.map(c => c.currentPrice || 0)),
    };
  }

  const output = {
    generatedAt: date + 'T09:00:00+08:00',
    lastUpdate: date,
    schools: schoolsArr,
    communities: communities,
    districtSummary: districtSummary,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log('✅ 看板数据已生成 → ' + OUT_FILE);
  console.log('   小区数:', communities.length, '学校数:', schoolsArr.length);
}

main(process.argv[2]);
