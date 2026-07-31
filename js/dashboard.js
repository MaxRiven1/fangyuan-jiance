// 学区房数智监测看板 - v2 商圈+路线+区域轮廓
(function() {
  'use strict';
  var C = DASHBOARD_CONFIG;
  var data = null;
  var map = null;
  var timer = null;

  function loadData() {
    fetch(C.dataFile + '?t=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(function(d) {
        data = d;
        document.getElementById('lastUpdate').textContent = d.generatedAt ? d.generatedAt.substring(0,10) : '--';
        document.getElementById('summaryTotal').textContent =
          '🏘️ ' + d.communities.length + '个小区 | 🏫 ' + d.schools.length + '所学校 | ' + (Object.values(d.pois||{}).reduce(function(s,l){return s+l.length},0)) + '个POI';
        renderLeft();
        renderRight();
        if (map) refreshMap();
      })
      .catch(function(e) {
        console.error('数据加载失败:', e);
        document.getElementById('lastUpdate').textContent = '加载失败';
      });
  }

  function renderLeft() {
    var container = document.getElementById('leftPanels');
    var html = '';
    C.districts.forEach(function(district) {
      var comms = data.communities.filter(function(c) { return c.district === district; });
      comms.sort(function(a,b) { return (a.currentPrice||0) - (b.currentPrice||0); });
      var dotClass = district==='金牛区'?'jinniu':district==='青羊区'?'qingyang':'chenghua';
      html += '<div class="district-block"><div class="district-title"><span class="dot '+dotClass+'"></span>'+district+'<span style="color:var(--text-dim);font-weight:400;font-size:11px">('+comms.length+'个小区)</span></div>';
      comms.forEach(function(c) {
        var tagClass = c.status || 'ok';
        html += '<div class="community-card" data-community="'+c.name+'" onclick="zoomToCommunity(\''+c.name+'\')">';
        html += '<div class="c-head"><span class="c-name">'+c.name+'</span><span class="c-pool '+(c.pool==='套三'?'s3':'s2')+'">'+c.pool+'</span></div>';
        html += '<div class="c-info"><span>📐 '+(c.layout||'?')+'</span><span>📏 '+(c.area||'?')+'㎡</span>'+(c.elevator?'<span>🛗 有电梯</span>':'<span>🚫 无电梯</span>')+'</div>';
        html += '<div class="c-school">🏫 '+(c.school||'?')+'</div>';
        html += '<div class="c-price-row"><span class="c-price">¥'+(c.currentPrice||'?')+'万</span><span class="price-tag '+tagClass+'">'+(c.statusText||'--')+'</span></div>';
        html += '<div class="c-note">'+(c.note||'')+'</div></div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function renderRight() {
    var container = document.getElementById('rightPanels');
    var html = '';
    C.districts.forEach(function(district) {
      var comms = data.communities.filter(function(c) { return c.district === district; });
      comms.sort(function(a,b) { return Math.abs(b.priceChangePct||0) - Math.abs(a.priceChangePct||0); });
      var dotClass = district==='金牛区'?'jinniu':district==='青羊区'?'qingyang':'chenghua';
      html += '<div class="district-block"><div class="district-title"><span class="dot '+dotClass+'"></span>'+district+' 价格变动</div>';
      comms.forEach(function(c) {
        var pct = c.priceChangePct || 0;
        var absPct = Math.abs(pct);
        var barClass = absPct>=20?'alert':absPct>=10?'orange':absPct>0?'warn':'ok';
        var chgClass = absPct>=20?'pc-chg-red':absPct>=10?'pc-chg-orange':absPct>0?'pc-chg-yellow':'pc-chg-green';
        var chgSign = pct>0?'+':'';
        var cardClass = absPct>=20?' price-change-card chg-alert':' price-change-card';
        var barPercent = Math.min(absPct*4, 100);
        html += '<div class="'+cardClass+'" data-community="'+c.name+'" onclick="zoomToCommunity(\''+c.name+'\')"><div class="pc-head"><span class="pc-name">'+c.name+'</span><span class="pc-pool '+(c.pool==='套三'?'s3':'s2')+'">'+c.pool+'</span></div>';
        html += '<div class="pc-bar-row"><span class="pc-label">基准</span><span class="pc-val">¥'+(c.price7dAvg||0).toFixed(1)+'万</span></div>';
        html += '<div class="pc-bar-row"><span class="pc-label">当前</span><div class="pc-bar-bg"><div class="pc-bar-fill '+barClass+'" style="width:'+barPercent+'%"></div></div><span class="pc-val '+chgClass+'">'+chgSign+pct.toFixed(1)+'%</span></div>';
        html += '<div class="pc-detail"><span>🏫 '+(c.school||'?')+'</span><span>📅 '+(c.daysCount||'4')+'天</span></div></div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function initMap() {
    try {
      map = new AMap.Map('amapContainer', { zoom: C.mapZoom, center: C.mapCenter, resizeEnable: true, mapStyle: 'amap://styles/blue' });
      console.log('高德地图初始化成功');
      // 预加载所有需要的插件
      AMap.plugin(['AMap.Transfer', 'AMap.DistrictSearch'], function() {
        console.log('Transfer + DistrictSearch 插件已加载');
        // 插件就绪后，如果data已加载，立即渲染轮廓
        if (data) addDistrictBoundaries();
      });
      // data先于插件加载时，refreshMap会再次调用addDistrictBoundaries
      if (data) refreshMap();
    } catch(e) {
      console.error('地图初始化失败:', e.message);
      document.getElementById('amapContainer').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef5350;font-size:14px;padding:20px;text-align:center"><div><div style="font-size:32px">⚠️</div><div style="margin-top:12px">' + (e.message||'未知错误') + '</div><div style="color:#8fa4b8;margin-top:8px;font-size:12px">请检查高德Key是否启用Web端JS API</div></div></div>';
    }
  }

  function refreshMap() {
    if (!map || !data) return;
    map.clearMap();
    renderMapMarkers();
    addDistrictBoundaries();
  }

  // 区域轮廓（DistrictSearch 需先通过 AMap.plugin 加载）
  var districtSearch = null;
  function addDistrictBoundaries() {
    var colors = { '金牛区':'#ff7043', '青羊区':'#66bb6a', '成华区':'#4fc3f7' };
    if (!AMap.DistrictSearch) {
      console.warn('DistrictSearch 未加载,跳过区域轮廓');
      return;
    }
    if (!districtSearch) districtSearch = new AMap.DistrictSearch({ level:'district', extensions:'all', subdistrict:0 });
    C.districts.forEach(function(name) {
      districtSearch.search(name, function(status, result) {
        if (status==='complete' && result.districtList && result.districtList.length>0) {
          var bounds = result.districtList[0].boundaries;
          if (!bounds) return;
          bounds.forEach(function(boundary) {
            var poly = new AMap.Polygon({
              path: boundary, fillColor: colors[name]||'#4fc3f7', fillOpacity: 0.06,
              strokeColor: colors[name]||'#4fc3f7', strokeWeight: 1.5, strokeOpacity: 0.4, zIndex: 1
            });
            poly.setMap(map); allPolylines.push(poly);
          });
        } else {
          console.warn('DistrictSearch失败:', name, status, result);
        }
      });
    });
  }

  var allMarkers = [];
  var allPolylines = [];
  var allInfoWindows = [];
  var allTransferLines = [];

  function renderMapMarkers() {
    if (!data) { console.warn('data未就绪，跳过renderMapMarkers'); return; }
    allMarkers.forEach(function(m) { try { m.setMap(null); } catch(e) {} });
    allPolylines.forEach(function(p) { try { p.setMap(null); } catch(e) {} });
    allInfoWindows.forEach(function(iw) { try { iw.close(); } catch(e) {} });
    allTransferLines.forEach(function(p) { try { p.setMap(null); } catch(e) {} });
    allMarkers = []; allPolylines = []; allInfoWindows = []; allTransferLines = [];

    // ===== 学校标记（放大） =====
    (data.schools||[]).forEach(function(s, idx) {
      var m = new AMap.Marker({
        position: [s.lng, s.lat],
        icon: new AMap.Icon({ size:new AMap.Size(22,22), image:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="10" fill="#e040fb" stroke="#fff" stroke-width="2.5"/><text x="11" y="15" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">校</text></svg>'), imageSize:new AMap.Size(22,22) }),
        offset: new AMap.Pixel(-11,-11), zIndex:100, title: s.name
      });
      m.setMap(map); allMarkers.push(m);

      var labelOffset = -16 + (idx%3)*16;
      var t = new AMap.Text({
        position: [s.lng, s.lat], text: s.name.indexOf('成都市')===0?s.name.replace('成都市',''):s.name,
        offset: new AMap.Pixel(0, labelOffset),
        style: {'background-color':'rgba(15,25,35,0.85)','color':'#e8edf2','font-size':'10px','padding':'1px 4px','border-radius':'2px','border':'none','white-space':'nowrap'}
      });
      t.setMap(map); allMarkers.push(t);
    });

    // ===== POI 标记 =====
    var typeStyles = { shopping:{color:'#ff7043',label:'商圈'}, transit:{color:'#29b6f6',label:'地铁'}, park:{color:'#66bb6a',label:'公园'}, hospital:{color:'#ef5350',label:'医院'}, landmark:{color:'#ab47bc',label:'地标'} };
    for (var district in data.pois || {}) {
      (data.pois[district]||[]).forEach(function(p) {
        var style = typeStyles[p.type] || typeStyles.shopping;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="20"><path d="M7 0 A7 7 0 0 0 0 7 C0 13 7 20 7 20 S14 13 14 7 A7 7 0 0 0 7 0 Z" fill="'+style.color+'" stroke="#fff" stroke-width="1"/><circle cx="7" cy="7" r="3" fill="#fff" opacity="0.9"/></svg>';
        var m = new AMap.Marker({
          position: [p.lng, p.lat],
          icon: new AMap.Icon({ size:new AMap.Size(14,20), image:'data:image/svg+xml,'+encodeURIComponent(svg), imageSize:new AMap.Size(14,20) }),
          offset: new AMap.Pixel(-7,-20), zIndex:60, title: '【'+style.label+'】 '+p.name
        });
        m.setMap(map); allMarkers.push(m);
      });
    }

    // ===== 小区标记 + 点击显示真实公交路线 =====
    (data.communities||[]).forEach(function(c) {
      var color = c.status==='ok'?'#66bb6a':c.status==='warn'?'#ffa726':'#ef5350';
      var m = new AMap.Marker({
        position: [c.lng, c.lat],
        icon: new AMap.Icon({ size:new AMap.Size(18,26), image:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="26"><path d="M9 0 C4 0 0 4 0 9 C0 15 9 26 9 26 S18 15 18 9 C18 4 14 0 9 0 Z" fill="'+color+'" stroke="#fff" stroke-width="2"/><circle cx="9" cy="9" r="5" fill="#fff" opacity="0.9"/></svg>'), imageSize:new AMap.Size(18,26) }),
        offset: new AMap.Pixel(-9,-26), zIndex:50, title: c.name+' ¥'+c.currentPrice+'万'
      });
      m.setMap(map); allMarkers.push(m);

      var t = new AMap.Text({
        position: [c.lng, c.lat], text: c.name.length>5?c.name.substring(0,4)+'…':c.name,
        offset: new AMap.Pixel(0,-24),
        style: {'background-color':'transparent','color':'#fff','font-size':'10px','font-weight':'bold','border':'none','white-space':'nowrap','text-shadow':'0 0 4px rgba(0,0,0,0.9)'}
      });
      t.setMap(map); allMarkers.push(t);

      // 找到对应学校
      var school = (data.schools||[]).find(function(s) {
        return (c.school||'').indexOf(s.name.replace('成都市','').replace('小学','').substring(0,2))>=0 || (c.school||'').indexOf(s.name.replace('成都市',''))>=0;
      });

      // 点击小区 → 清除旧路线 + 公交路线规划
      m.on('click', function() {
        allTransferLines.forEach(function(p) { try { p.setMap(null); } catch(e) {} });
        allInfoWindows.forEach(function(iw) { try { iw.close(); } catch(e) {} });
        allTransferLines = [];

        if (!school) return;
        var dist = haversine(c.lng, c.lat, school.lng, school.lat);

        // 真实公交路线
        try {
          var transfer = new AMap.Transfer({ map: map, city: '成都', extensions: 'all' });
          transfer.search([c.lng, c.lat], [school.lng, school.lat], function(status, result) {
            if (status === 'complete' && result.plans && result.plans.length > 0) {
              var plan = result.plans[0];
              // 画所有路段
              plan.routes.forEach(function(route, ri) {
                var routePath = [];
                if (route.walking_distance) {
                  route.steps.forEach(function(step) {
                    if (step.path && step.path.length > 1) routePath = routePath.concat(step.path);
                  });
                } else if (route.bus) {
                  var busStops = [];
                  (route.bus.buslines||[]).forEach(function(bl) {
                    bl.path.forEach(function(p) { busStops.push(p); });
                  });
                  routePath = busStops;
                }
                if (routePath.length > 1) {
                  var poly = new AMap.Polyline({
                    path: routePath,
                    strokeColor: ri===0?'#66bb6a':'#4fc3f7',
                    strokeWeight: 4,
                    strokeOpacity: 0.7,
                    zIndex: 199
                  });
                  poly.setMap(map);
                  allTransferLines.push(poly);
                }
              });
            }
            // 气泡（始终显示）
            var walkMin = Math.round(dist / 80);
            var content = '<div style="padding:8px 12px;font-size:12px;min-width:220px"><b style="color:#0f1923;font-size:13px">'+school.name+'</b><br/><span style="color:#666">📍 '+ (school.address||'') +'</span><hr style="margin:4px 0;border:none;border-top:1px solid #eee"/><b>→ '+c.name+'</b><br/><span style="color:#666">直线距离: <b style="color:#4fc3f7">'+dist.toFixed(0)+'米</b> | 步行约'+walkMin+'分钟</span><br/><span style="font-size:10px;color:#999">蓝色=公交路线 | 绿色=步行段</span></div>';
            var iw = new AMap.InfoWindow({ content: content, offset: new AMap.Pixel(0,-10) });
            iw.open(map, [school.lng, school.lat]);
            allInfoWindows.push(iw);
          });
        } catch(err) {
          console.log('公交路线规划失败,回退直线:', err);
          // 回退直线
          var line = new AMap.Polyline({ path:[[c.lng,c.lat],[school.lng,school.lat]], strokeColor:'#4fc3f7', strokeWeight:2, strokeStyle:'dashed', zIndex:199 });
          line.setMap(map); allTransferLines.push(line);
          var content = '<div style="padding:8px 12px;font-size:12px"><b style="font-size:13px">'+school.name+'</b><br/><span style="color:#666">→ '+c.name+'</span><br/><span style="color:#4fc3f7">直线距离 '+dist.toFixed(0)+'米</span></div>';
          var iw = new AMap.InfoWindow({ content:content, offset:new AMap.Pixel(0,-10) });
          iw.open(map, [school.lng, school.lat]); allInfoWindows.push(iw);
        }
      });
    });
  }

  function haversine(l1, la1, l2, la2) {
    var R=6371000;
    var toRad=function(d){return d*Math.PI/180;};
    var dLat=toRad(la2-la1), dLng=toRad(l2-l1);
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(la1))*Math.cos(toRad(la2))*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  // 点击面板中的小区名 → 地图缩放定位到该小区
  function zoomToCommunity(name) {
    if (!map || !data) return;
    var c = (data.communities||[]).find(function(x) { return x.name === name; });
    if (!c) return;
    // 平滑飞到该位置并放大
    map.setZoomAndCenter(16, [c.lng, c.lat]);
    // 弹窗提示
    var iw = new AMap.InfoWindow({
      content: '<div style="padding:6px 10px;font-size:12px"><b>'+c.name+'</b> ¥'+c.currentPrice+'万<br/><span style="color:#666">'+c.school+' | '+c.layout+'</span></div>',
      offset: new AMap.Pixel(0,-30)
    });
    iw.open(map, [c.lng, c.lat]);
    setTimeout(function() { iw.close(); }, 4000);
  }

  window.zoomToCommunity = zoomToCommunity;

  function startPolling() {
    loadData();
    if (timer) clearInterval(timer);
    timer = setInterval(loadData, C.pollInterval);
  }

  window.addEventListener('amap-ready', function() {
    if (typeof AMap!=='undefined' && !map) initMap();
  });
  setTimeout(function() { if (typeof AMap!=='undefined' && !map) initMap(); }, 2000);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', startPolling);
  else startPolling();
})();