// 学区房数智监测看板 - 核心逻辑
(function() {
  'use strict';
  var C = DASHBOARD_CONFIG;
  var data = null;
  var map = null;
  var markersLayer = null;
  var timer = null;

  // ===== 数据加载 =====
  function loadData() {
    fetch(C.dataFile + '?t=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(function(d) {
        data = d;
        document.getElementById('lastUpdate').textContent = data.lastUpdate || data.generatedAt;
        document.getElementById('summaryTotal').textContent =
          '🏘️ ' + data.communities.length + '个小区 | 🏫 ' + data.schools.length + '所学校';
        renderLeft();
        renderRight();
        if (map) refreshMap();
      })
      .catch(function(e) {
        console.error('数据加载失败:', e);
        document.getElementById('lastUpdate').textContent = '加载失败';
      });
  }

  // ===== 左侧：小区详情3区面板 =====
  function renderLeft() {
    var container = document.getElementById('leftPanels');
    var html = '';
    C.districts.forEach(function(district) {
      var comms = data.communities.filter(function(c) { return c.district === district; });
      comms.sort(function(a,b) { return (a.currentPrice||0) - (b.currentPrice||0); });
      var dotClass = '';
      if (district === '金牛区') dotClass = 'jinniu';
      else if (district === '青羊区') dotClass = 'qingyang';
      else dotClass = 'chenghua';
      html += '<div class="district-block">';
      html += '<div class="district-title"><span class="dot ' + dotClass + '"></span>' + district + ' <span style="color:var(--text-dim);font-weight:400;font-size:11px">(' + comms.length + '个小区)</span></div>';
      comms.forEach(function(c) {
        var poolClass = c.pool === '套三' ? 's3' : 's2';
        var tagClass = c.status || 'ok';
        html += '<div class="community-card">';
        html += '<div class="c-head"><span class="c-name">' + c.name + '</span><span class="c-pool ' + poolClass + '">' + c.pool + '</span></div>';
        html += '<div class="c-info"><span>📐 ' + (c.layout||'?') + '</span><span>📏 ' + (c.area||'?') + '㎡</span>' + (c.elevator ? '<span>🛗 有电梯</span>' : '<span>🚫 无电梯</span>') + '</div>';
        html += '<div class="c-school">🏫 ' + (c.school||'?') + '</div>';
        html += '<div class="c-price-row"><span class="c-price">¥' + (c.currentPrice||'?') + '万</span><span class="price-tag ' + tagClass + '">' + (c.statusText||'--') + '</span></div>';
        html += '<div class="c-note">' + (c.note||'') + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // ===== 右侧：价格变动3区面板 =====
  function renderRight() {
    var container = document.getElementById('rightPanels');
    var html = '';
    C.districts.forEach(function(district) {
      var comms = data.communities.filter(function(c) { return c.district === district; });
      comms.sort(function(a,b) { return Math.abs(b.priceChangePct||0) - Math.abs(a.priceChangePct||0); });
      var dotClass = '';
      if (district === '金牛区') dotClass = 'jinniu';
      else if (district === '青羊区') dotClass = 'qingyang';
      else dotClass = 'chenghua';
      html += '<div class="district-block">';
      html += '<div class="district-title"><span class="dot ' + dotClass + '"></span>' + district + ' 价格变动</div>';
      comms.forEach(function(c) {
        var pct = c.priceChangePct || 0;
        var absPct = Math.abs(pct);
        var barClass = absPct >= 20 ? 'alert' : absPct >= 10 ? 'orange' : absPct > 0 ? 'warn' : 'ok';
        var chgClass = absPct >= 20 ? 'pc-chg-red' : absPct >= 10 ? 'pc-chg-orange' : absPct > 0 ? 'pc-chg-yellow' : 'pc-chg-green';
        var chgSign = pct > 0 ? '+' : '';
        var cardClass = absPct >= 20 ? ' price-change-card chg-alert' : ' price-change-card';
        var poolClass = c.pool === '套三' ? 's3' : 's2';
        var barPercent = Math.min(absPct * 4, 100); // Scale so 25% = 100% bar width

        html += '<div class="' + cardClass + '">';
        html += '<div class="pc-head"><span class="pc-name">' + c.name + '</span><span class="pc-pool ' + poolClass + '">' + c.pool + '</span></div>';
        html += '<div class="pc-bar-row"><span class="pc-label">基准</span><span class="pc-val">¥' + (c.price7dAvg||0).toFixed(1) + '万</span></div>';
        html += '<div class="pc-bar-row"><span class="pc-label">当前</span><div class="pc-bar-bg"><div class="pc-bar-fill ' + barClass + '" style="width:' + barPercent + '%"></div></div><span class="pc-val ' + chgClass + '">' + chgSign + pct.toFixed(1) + '%</span></div>';
        html += '<div class="pc-detail"><span>🏫 ' + (c.school||'?') + '</span><span>📅 历史天数: ' + (c.daysCount||'4') + '天</span></div>';
        html += '</div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // ===== 地图初始化 =====
  function initMap() {
    map = new AMap.Map('amapContainer', {
      zoom: C.mapZoom,
      center: C.mapCenter,
      mapStyle: 'amap://styles/dark',
      resizeEnable: true
    });
    markersLayer = new AMap.LabelsLayer({ zooms: [3,20], zIndex: 10, collision: false });
    map.add(markersLayer);
    renderMapMarkers();
  }

  function refreshMap() {
    if (!map || !data) return;
    markersLayer.clear();
    renderMapMarkers();
  }

  function renderMapMarkers() {
    var markers = [];

    // 学校标记（紫色圆点 + 标签）
    (data.schools||[]).forEach(function(s, idx) {
      var dy = (idx % 3) * 18 - 18;
      markers.push({
        position: [s.lng, s.lat],
        icon: { type: 'circle', size: [10,10], color: '#e040fb', strokeColor: '#fff', strokeWeight: 2 },
        rank: 10
      });
      // 校名标签
      var textColor = '#e8edf2';
      var bgColor = 'rgba(15,25,35,0.85)';
      markers.push({
        position: [s.lng, s.lat],
        icon: null,
        text: {
          content: s.name.indexOf('成都市')===0 ? s.name.replace('成都市','') : s.name,
          direction: 'top',
          offset: '10 -' + 5,
          style: { fontSize: 10, fill: textColor, stroke: bgColor, strokeWidth: 3 }
        },
        rank: 11
      });
    });

    // 小区标记（颜色按status分）
    (data.communities||[]).forEach(function(c) {
      var color = c.status === 'ok' ? '#66bb6a' : c.status === 'warn' ? '#ffa726' : '#ef5350';
      markers.push({
        position: [c.lng, c.lat],
        icon: { type: 'circle', size: [8,8], color: color, strokeColor: '#fff', strokeWeight: 1.5 },
        rank: 5
      });
      markers.push({
        position: [c.lng, c.lat],
        icon: null,
        text: {
          content: c.name.length > 6 ? c.name.substring(0,5)+'…' : c.name,
          direction: 'right',
          offset: '0 8',
          style: { fontSize: 9, fill: '#8fa4b8', stroke: 'rgba(15,25,35,0.8)', strokeWidth: 4 }
        },
        rank: 6
      });
    });

    markersLayer.add(markers);
  }

  // ===== 轮询 =====
  function startPolling() {
    loadData();
    if (timer) clearInterval(timer);
    timer = setInterval(loadData, C.pollInterval);
  }

  // ===== 入口 =====
  function ready() {
    // 等待高德 SDK 加载
    if (typeof AMap !== 'undefined') {
      initMap();
    }
    // 即使地图未加载，数据面板也先渲染
    loadData();
    startPolling();
  }

  window.addEventListener('amap-ready', function() {
    if (typeof AMap !== 'undefined' && !map) initMap();
  });

  // 如果AMap已提前加载（直接<script>方式）
  setTimeout(function() {
    if (typeof AMap !== 'undefined' && !map) initMap();
  }, 2000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
