// 批量高德地理编码：学校+小区 → 经纬度
const fs = require('fs');
const https = require('https');

const KEY = 'a95a8b6a75a76556a005f3966b9668ba';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function geocode(address, city = '成都') {
  return new Promise((resolve, reject) => {
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${KEY}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`;
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.status === '1' && j.geocodes && j.geocodes.length > 0) {
            const loc = j.geocodes[0].location.split(',');
            resolve({ lng: parseFloat(loc[0]), lat: parseFloat(loc[1]), formatted: j.geocodes[0].formatted_address || j.geocodes[0].address || '' });
          } else {
            resolve(null);
          }
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const schools = [
  { key: 'syxx', name: '成都市实验小学', district: '青羊区' },
  { key: 'ptxx', name: '成都市泡桐树小学', district: '青羊区' },
  { key: 'dcgxx', name: '成都市东城根街小学', district: '青羊区' },
  { key: 'sxxx', name: '成都市胜西小学', district: '青羊区' },
  { key: 'scxx', name: '成都市少城小学', district: '青羊区' },
  { key: 'ctxx', name: '成都市草堂小学', district: '青羊区' },
  { key: 'jsxx', name: '成都市金沙小学', district: '青羊区' },
  { key: 'rmblxx', name: '成都市人民北路小学', district: '金牛区' },
  { key: 'ssjxx', name: '成都市石笋街小学', district: '金牛区' },
  { key: 'cdzxx', name: '成都市茶店子小学', district: '金牛区' },
  { key: 'ssxx', name: '成都市石室小学', district: '成华区' },
  { key: 'slxx', name: '成都市双林小学', district: '成华区' },
  { key: 'chxx', name: '成都市成华小学', district: '成华区' },
  { key: 'jslxx', name: '成都市建设路小学', district: '成华区' },
];

const communities = [
  { key: 'hflsq', name: '红枫岭三期', district: '成华区' },
  { key: 'dcsd', name: '鼎城上都', district: '成华区' },
  { key: 'lrvksd', name: '蓝润V客尚东', district: '成华区' },
  { key: 'wkjssy', name: '万科金色领域', district: '青羊区' },
  { key: 'hxjy', name: '和谐家园', district: '金牛区' },
  { key: 'lgklhj', name: '蓝光凯丽豪景', district: '金牛区' },
  { key: 'lgyd', name: '蓝光云鼎', district: '金牛区' },
  { key: 'zjsa', name: '中加水岸', district: '金牛区' },
  { key: 'qxyz', name: '清溪雅筑', district: '青羊区' },
  { key: 'hh28', name: '和泓东28', district: '成华区' },
  { key: 'hynhj', name: '花样年花郡', district: '成华区' },
  { key: 'sdky', name: '时代凯悦', district: '青羊区' },
  { key: 'xctx', name: '西城天下', district: '金牛区' },
];

(async () => {
  const result = { schools: {}, communities: {} };
  const all = [...schools.map(s => ({ type: 'school', ...s })), ...communities.map(c => ({ type: 'community', ...c }))];
  for (const item of all) {
    const addr = `成都市${item.district}${item.name}`;
    const r = await geocode(addr, '成都');
    console.log(`${item.type}: ${item.name} → ${r ? r.lng+','+r.lat : 'FAIL'}`);
    if (item.type === 'school') result.schools[item.key] = { name: item.name, district: item.district, ...r };
    else result.communities[item.key] = { name: item.name, district: item.district, ...r };
    await sleep(200);
  }
  fs.writeFileSync(__dirname + '/coordinates.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('DONE → coordinates.json');
})();
