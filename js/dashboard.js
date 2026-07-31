// 学区房数智监测看板 - 核心逻辑
(function() {
  'use strict';
  var C = DASHBOARD_CONFIG;
  var data = null;
  var map = null;
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
    try {
      map = new AMap.Map('amapContainer', {
        zoom: C.mapZoom,
        center: C.mapCenter,
        resizeEnable: true
      });
      console.log('✅ 高德地图初始化成功');
      renderMapMarkers();
    } catch(e) {
      console.error('❌ 地图初始化失败:', e.message);
      document.getElementById('amapContainer').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8fa4b8;font-size:14px">⚠️ 地图加载失败，请检查高德Key是否正确</div>';
    }
  }

  function refreshMap() {
    if (!map || !data) return;
    map.clearMap();
    renderMapMarkers();
  }

  var allMarkers = [];
  var allPolylines = [];
  var allInfoWindows = [];
  function renderMapMarkers() {
    allMarkers.forEach(function(m) { try { m.setMap(null); } catch(e) {} });
    allPolylines.forEach(function(p) { try { p.setMap(null); } catch(e) {} });
    allInfoWindows.forEach(function(iw) { try { iw.close(); } catch(e) {} });
    allMarkers = [];
    allPolylines = [];
    allInfoWindows = [];

    // 学校标记
    (data.schools||[]).forEach(function(s) {
      var m = new AMap.Marker({
        position: [s.lng, s.lat],
        icon: new AMap.Icon({
          size: new AMap.Size(16, 16),
          image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#e040fb" stroke="#fff" stroke-width="2"/><text x="8" y="11" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">S</text></svg>'),
          imageSize: new AMap.Size(16, 16)
        }),
        offset: new AMap.Pixel(-8, -8),
        zIndex: 100,
        title: s.name
      });
      m.setMap(map);
      allMarkers.push(m);

      // 校名标签
      var labelOffset = (allMarkers.length % 3) * 14 - 14;
      var t = new AMap.Text({
        position: [s.lng, s.lat],
        text: s.name.indexOf('成都市')===0 ? s.name.replace('成都市','') : s.name,
        offset: new AMap.Pixel(0, labelOffset),
        style: {
          'background-color': 'rgba(15,25,35,0.85)',
          'color': '#e8edf2',
          'font-size': '10px',
          'padding': '1px 4px',
          'border-radius': '2px',
          'border': 'none',
          'white-space': 'nowrap'
        }
      });
      t.setMap(map);
      allMarkers.push(t);
    });

    // 周边商圈POI标记（橙色）
    var typeColors = { shopping: '#ff7043', transit: '#29b6f6', park: '#66bb6a', landmark: '#ab47bc' };
    (data.pois||{}).forEach(function(list, district) {
      (list||[]).forEach(function(p) {
        var color = typeColors[p.type] || '#ff7043';
        var iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="18"><path d="M7 0 a7 7 0 0 0 -7 7 c0 5 7 11 7 11 s7 -6 7 -11 a7 7 0 0 0 -7 -7 z" fill="' + color + '" stroke="#fff" stroke-width="1"/><circle cx="7" cy="7" r="3" fill="#fff"/></svg>';
        var m = new AMap.Marker({
          position: [p.lng, p.lat],
          icon: new AMap.Icon({
            size: new AMap.Size(14, 18),
            image: 'data:image/svg+xml,' + encodeURIComponent(iconSvg),
            imageSize: new AMap.Size(14, 18)
          }),
          offset: new AMap.Pixel(-7, -18),
          zIndex: 60,
          title: '【' + (p.type||'POI') + '】 ' + p.name + '\n地址: ' + (p.address||'')
        });
        m.setMap(map);
        allMarkers.push(m);
      });
    });

    // 小区标记（颜色按status分）+ 点击显示路线
    (data.communities||[]).forEach(function(c) {
      var color = c.status === 'ok' ? '#66bb6a' : c.status === 'warn' ? '#ffa726' : '#ef5350';
      var m = new AMap.Marker({
        position: [c.lng, c.lat],
        icon: new AMap.Icon({
          size: new AMap.Size(12, 12),
          image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>'),
          imageSize: new AMap.Size(12, 12)
        }),
        offset: new AMap.Pixel(-6, -6),
        zIndex: 50,
        title: c.name + ' ¥' + c.currentPrice + '万'
      });
      m.setMap(map);
      allMarkers.push(m);

      var t = new AMap.Text({
        position: [c.lng, c.lat],
        text: c.name.length > 5 ? c.name.substring(0,4)+'…' : c.name,
        offset: new AMap.Pixel(8, -4),
        style: {
          'background-color': 'transparent',
          'color': '#8fa4b8',
          'font-size': '9px',
          'border': 'none',
          'white-space': 'nowrap',
          'text-shadow': '0 0 3px rgba(0,0,0,0.8)'
        }
      });
      t.setMap(map);
      allMarkers.push(t);

      // 找到对应学校
      var school = (data.schools||[]).find(function(s) {
        return (c.school||'').indexOf(s.name.replace('成都市','').replace('小学','').substring(0,2)) >= 0 ||
               (c.school||'').indexOf(s.name.replace('成都市','')) >= 0;
      });

      // 点击小区 → 画路线 + 气泡显示距离
      m.on('click', function() {
        // 清除已有路线
        allPolylines.forEach(function(p) { try { p.setMap(null); } catch(e) {} });
        allInfoWindows.forEach(function(iw) { try { iw.close(); } catch(e) {} });
        allPolylines = [];
        allInfoWindows = [];

        if (school) {
          // 距离
          var dist = haversine(c.lng, c.lat, school.lng, school.lat);
          // 路线
          var line = new AMap.Polyline({
            path: [[c.lng, c.lat], [school.lng, school.lat]],
            strokeColor: '#4fc3f7',
            strokeWeight: 3,
            strokeStyle: 'dashed',
            zIndex: 200
          });
          line.setMap(map);
          allPolylines.push(line);

          // 距离标签
          var distLabel = new AMap.Text({
            position: [(c.lng + school.lng) / 2, (c.lat + school.lat) / 2],
            text: '↔ ' + dist.toFixed(0) + '米',
            offset: new AMap.Pixel(0, 0),
            style: {
              'background-color': '#4fc3f7',
              'color': '#0f1923',
              'font-size': '11px',
              'font-weight': 'bold',
              'padding': '2px 6px',
              'border-radius': '3px',
              'border': 'none',
              'white-space': 'nowrap'
            }
          });
          distLabel.setMap(map);
          allPolylines.push(distLabel);

          // 气泡
          var iw = new AMap.InfoWindow({
            content: '<div style="padding:8px 12px;font-size:12px;color:#222;min-width:200px">' +
                     '<b style="color:#0f1923;font-size:13px">' + school.name + '</b><br/>' +
                     '<span style="color:#666">📍 ' + (school.address||'') + '</span><br/>' +
                     '<hr style="margin:4px 0;border:none;border-top:1px solid #eee"/>' +
                     '<b style="color:#0f1923">→ ' + c.name + '</b><br/>' +
                     '<span style="color:#666">距离: <b style="color:#4fc3f7">' + dist.toFixed(0) + '米</b> | 步行约' + Math.round(dist/80) + '分钟</span>' +
                     '</div>',
            offset: new AMap.Pixel(0, -10)
          });
          iw.open(map, [school.lng, school.lat]);
          allInfoWindows.push(iw);
        }
      });
    });
  }

  // 哈弗辛公式：两点经纬度→米
  function haversine(lng1, lat1, lng2, lat2) {
    var R = 6371000;
    var toRad = function(d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
