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
                var lo = document.getElementById('loadingOverlay');
        if (lo) lo.style.display = 'none';
        document.getElementById('lastUpdate').textContent = d.generatedAt ? d.generatedAt.substring(0,16) : '--';
        // 启动时效更新
        startFreshnessTimer();
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
        // 迷你趋势线
        var hist = c.priceHistory || [];
        if (hist.length > 1) {
          var hMax = Math.max(...hist), hMin = Math.min(...hist), hRange = hMax - hMin || 1;
          var pts = hist.map(function(v,i){ return (i*3+1) + ',' + (20 - Math.round((v-hMin)/hRange*16)); }).join(' ');
          html += '<div style="margin:4px 0"><svg width="'+(hist.length*3)+'" height="22" style="vertical-align:middle"><polyline points="'+pts+'" fill="none" stroke="'+(c.priceChangePct>=0?'#ef5350':'#66bb6a')+'" stroke-width="1.5"/><circle cx="1" cy="'+(20-Math.round((hist[0]-hMin)/hRange*16))+'" r="1.5" fill="#8fa4b8"/><circle cx="'+(hist.length*3-2)+'" cy="'+(20-Math.round((hist[hist.length-1]-hMin)/hRange*16))+'" r="1.5" fill="'+(c.priceChangePct>=0?'#ef5350':'#66bb6a')+'"/></svg></div>';
        }
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
              path: boundary, fillColor: colors[name]||'#4fc3f7', fillOpacity: 0.18,
              strokeColor: colors[name]||'#4fc3f7', strokeWeight: 2.5, strokeOpacity: 0.8, zIndex: 1
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
        icon: new AMap.Icon({ size:new AMap.Size(33,33), image:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="33" height="33"><circle cx="16.5" cy="16.5" r="15" fill="#e040fb" stroke="#fff" stroke-width="3"/><text x="16.5" y="21" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold">校</text></svg>'), imageSize:new AMap.Size(33,33) }),
        offset: new AMap.Pixel(-16,-16), zIndex:100, title: s.name
      });
      m.setMap(map); allMarkers.push(m);

      var labelOffset = -16 + (idx%3)*16;
      var t = new AMap.Text({
        position: [s.lng, s.lat], text: s.name.indexOf('成都市')===0?s.name.replace('成都市',''):s.name,
        offset: new AMap.Pixel(0, labelOffset),
        style: {'background-color':'rgba(15,25,35,0.85)','color':'#e8edf2','font-size':'15px','padding':'2px 6px','border-radius':'3px','border':'none','white-space':'nowrap'}
      });
      t.setMap(map); allMarkers.push(t);
    });

    // ===== POI 标记 =====
    var typeStyles = { shopping:{color:'#ff7043',label:'商'}, transit:{color:'#29b6f6',label:'铁'}, park:{color:'#66bb6a',label:'园'}, hospital:{color:'#ef5350',label:'医'}, landmark:{color:'#ab47bc',label:'景'} };
    for (var district in data.pois || {}) {
      (data.pois[district]||[]).forEach(function(p) {
        var style = typeStyles[p.type] || typeStyles.shopping;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="13" fill="'+style.color+'" stroke="#fff" stroke-width="2.5"/><text x="14" y="19" text-anchor="middle" font-size="15" fill="#fff" font-weight="bold">'+style.label+'</text></svg>';
        var m = new AMap.Marker({
          position: [p.lng, p.lat],
          icon: new AMap.Icon({ size:new AMap.Size(28,28), image:'data:image/svg+xml,'+encodeURIComponent(svg), imageSize:new AMap.Size(28,28) }),
          offset: new AMap.Pixel(-14,-14), zIndex:60, title: '【'+style.label+'】 '+p.name
        });
        m.setMap(map); allMarkers.push(m);
        // POI名称标签
        var pt = new AMap.Text({
          position: [p.lng, p.lat],
          text: p.name.length > 7 ? p.name.substring(0,6)+'…' : p.name,
          offset: new AMap.Pixel(0, -34),
          style: {'background-color':'rgba(15,25,35,0.85)','color':style.color,'font-size':'12px','padding':'2px 5px','border-radius':'3px','border':'none','white-space':'nowrap'}
        });
        pt.setMap(map); allMarkers.push(pt);
      });
    }

    // ===== 小区标记 + 点击显示真实公交路线 =====
    (data.communities||[]).forEach(function(c) {
      var color = c.status==='ok'?'#66bb6a':c.status==='warn'?'#ffa726':'#ef5350';
      var m = new AMap.Marker({
        position: [c.lng, c.lat],
        icon: new AMap.Icon({ size:new AMap.Size(27,39), image:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="27" height="39"><path d="M13.5 0 C6 0 0 6 0 13.5 C0 22 13.5 39 13.5 39 S27 22 27 13.5 C27 6 21 0 13.5 0 Z" fill="'+color+'" stroke="#fff" stroke-width="3"/><circle cx="13.5" cy="13.5" r="7.5" fill="#fff" opacity="0.9"/></svg>'), imageSize:new AMap.Size(27,39) }),
        offset: new AMap.Pixel(-13.5,-39), zIndex:50, title: c.name+' ¥'+c.currentPrice+'万'
      });
      m.setMap(map); allMarkers.push(m);

      var t = new AMap.Text({
        position: [c.lng, c.lat], text: c.name.length>5?c.name.substring(0,4)+'…':c.name,
        offset: new AMap.Pixel(0,-24),
        style: {'background-color':'transparent','color':'#fff','font-size':'15px','font-weight':'bold','border':'none','white-space':'nowrap','text-shadow':'0 0 5px rgba(0,0,0,0.95)'}
      });
      t.setMap(map); allMarkers.push(t);

      // 找到对应学校
      var school = (data.schools||[]).find(function(s) {
        return (c.school||'').indexOf(s.name.replace('成都市','').replace('小学','').substring(0,2))>=0 || (c.school||'').indexOf(s.name.replace('成都市',''))>=0;
      });

      // 点击小区 → 画路线
      m.on('click', function() {
        if (!school) return;
        drawRoute(c, school);
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

  // 点击面板中的小区名 → 地图缩放定位 + 同步画路线
  function zoomToCommunity(name) {
    if (!map || !data) return;
    var c = (data.communities||[]).find(function(x) { return x.name === name; });
    if (!c) return;
    map.setZoomAndCenter(16, [c.lng, c.lat]);
    // 找到对应学校并模拟点击事件触发路线
    var school = (data.schools||[]).find(function(s) {
      return (c.school||'').indexOf(s.name.replace('成都市','').replace('小学','').substring(0,2))>=0 
        || (c.school||'').indexOf(s.name.replace('成都市',''))>=0;
    });
    if (school) drawRoute(c, school);
  }

  // 回全景
  function resetMapView() {
    if (!map) return;
    map.setZoomAndCenter(C.mapZoom, C.mapCenter);
  }

  // 路线+气泡提取为独立函数（marker点击和面板点击共用）
  function drawRoute(c, school) {
    allTransferLines.forEach(function(p) { try { p.setMap(null); } catch(e) {} });
    allInfoWindows.forEach(function(iw) { try { iw.close(); } catch(e) {} });
    allTransferLines = [];
    var dist = haversine(c.lng, c.lat, school.lng, school.lat);
    var walkMin = Math.round(dist / 80);
    var showContent = function() {
      var content = '<div style="padding:8px 12px;font-size:12px;min-width:220px"><b style="color:#0f1923;font-size:13px">'+school.name+'</b><br/><span style="color:#666">📍 '+ (school.address||'') +'</span><hr style="margin:4px 0;border:none;border-top:1px solid #eee"/><b>→ '+c.name+'</b><br/><span style="color:#666">直线距离: <b style="color:#4fc3f7">'+dist.toFixed(0)+'米</b> | 步行约'+walkMin+'分钟</span><br/><span style="font-size:10px;color:#999">蓝色虚线=直线距离 | 实线=公交/步行</span></div>';
      var iw = new AMap.InfoWindow({ content: content, offset: new AMap.Pixel(0,-10) });
      iw.open(map, [school.lng, school.lat]); allInfoWindows.push(iw);
    };
    var hasRoute = false;
    try {
      var transfer = new AMap.Transfer({ map: map, city: '成都', extensions: 'all' });
      transfer.search([c.lng, c.lat], [school.lng, school.lat], function(status, result) {
        if (status==='complete' && result.plans && result.plans.length>0) {
          result.plans[0].routes.forEach(function(route, ri) {
            var routePath=[];
            if (route.walking_distance) route.steps.forEach(function(s){if(s.path&&s.path.length>1)routePath=routePath.concat(s.path);});
            else if (route.bus) (route.bus.buslines||[]).forEach(function(bl){bl.path.forEach(function(p){routePath.push(p);});});
            if(routePath.length>1){
              var poly=new AMap.Polyline({path:routePath,strokeColor:ri===0?'#66bb6a':'#4fc3f7',strokeWeight:4,strokeOpacity:0.7,zIndex:199});
              poly.setMap(map);allTransferLines.push(poly);hasRoute=true;
            }
          });
        }
        if (!hasRoute) {
          // Transfer未返回有效路径,画fallback直线
          var dashed = new AMap.Polyline({path:[[c.lng,c.lat],[school.lng,school.lat]],strokeColor:'#4fc3f7',strokeWeight:2,strokeStyle:'dashed',zIndex:199});
          dashed.setMap(map); allTransferLines.push(dashed);
        }
        showContent();
      });
    } catch(err){
      // 抛错时画fallback直线
      var dashed = new AMap.Polyline({path:[[c.lng,c.lat],[school.lng,school.lat]],strokeColor:'#4fc3f7',strokeWeight:2,strokeStyle:'dashed',zIndex:199});
      dashed.setMap(map); allTransferLines.push(dashed);
      showContent();
    }
  }

  // 键盘快捷键
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === '0') resetMapView();
    if (e.key === '1' && data) { var cs=data.communities.filter(function(c){return c.district==='金牛区'}); if(cs.length) map.setZoomAndCenter(14,[cs[0].lng,cs[0].lat]); }
    if (e.key === '2' && data) { var cs=data.communities.filter(function(c){return c.district==='青羊区'}); if(cs.length) map.setZoomAndCenter(14,[cs[0].lng,cs[0].lat]); }
    if (e.key === '3' && data) { var cs=data.communities.filter(function(c){return c.district==='成华区'}); if(cs.length) map.setZoomAndCenter(14,[cs[0].lng,cs[0].lat]); }
  });

  window.zoomToCommunity = zoomToCommunity;
  window.resetMapView = resetMapView;

  // 时效计数器
  var freshnessTimer = null;
  var lastLoadTime = null;
  function startFreshnessTimer() {
    lastLoadTime = Date.now();
    if (freshnessTimer) clearInterval(freshnessTimer);
    freshnessTimer = setInterval(function() {
      var mins = Math.floor((Date.now() - lastLoadTime) / 60000);
      var el = document.getElementById('lastUpdate');
      if (mins === 0) el.textContent = '刚刚更新';
      else if (mins < 60) el.textContent = mins + '分钟前';
      else { var h = Math.floor(mins/60); var m = mins%60; el.textContent = h + '小时' + m + '分钟前'; }
    }, 30000);
  }

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