// 房源监测数智看板 - 配置文件
window.DASHBOARD_CONFIG = {
  // 高德地图 JS API Key
  amapKey: 'e65d26f058d43da841817ebcc64af5e0',
  amapVersion: '2.0',
  
  // 数据文件路径（相对看板根目录）
  dataFile: 'data/dashboard-data.json',
  
  // 数据轮询间隔（毫秒）
  pollInterval: 30 * 60 * 1000, // 30分钟
  
  // 价格变动阈值
  thresholds: {
    warning: 10,   // 黄色警告 (%)
    alert: 20      // 红色警报 (%)
  },
  
  // 地图默认中心（成都市区）
  mapCenter: [104.06, 30.67],
  mapZoom: 12,
  
  // 3个行政区
  districts: ['金牛区', '青羊区', '成华区'],
  
  // 数据更新时间
  lastUpdate: '2026-07-31',
};
