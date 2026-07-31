// 购房对比系统
(function() {
'use strict';

var selectedIds = [];
var compareModal = null;

function ensureModal() {
  if (compareModal) return;
  compareModal = document.createElement('div');
  compareModal.id = 'compareModal';
  compareModal.innerHTML = '<div class="compare-overlay" onclick="closeCompare()"></div><div class="compare-panel" id="comparePanel"></div>';
  document.body.appendChild(compareModal);
}

// 统一取值:schoolDist是数字,其他是{name,dist}对象
function getDist(s, key) {
  if (!s) return 9999;
  if (key === 'schoolDist') return s.schoolDist;
  var obj = s[key];
  return obj ? obj.dist : 9999;
}

window.toggleCompare = function(name) {
  var idx = selectedIds.indexOf(name);
  if (idx >= 0) { selectedIds.splice(idx,1); }
  else if (selectedIds.length < 5) { selectedIds.push(name); }
  else { return; }
  updateCheckmarks();
  updateCompareBar();
};

window.openCompare = function() {
  if (selectedIds.length < 2) return;
  ensureModal();
  var list = selectedIds.map(function(n) {
    var c = (window._dashboardData||[]).find(function(x) { return x.name === n; });
    return c ? { community:c, scores:window._computeScore ? window._computeScore(c) : null } : null;
  }).filter(function(x){ return x && x.scores; });
  if (list.length < 2) { alert('无足够数据'); return; }

  // 按综合分降序排名
  list.sort(function(a,b){ return (b.scores.totalPct||0) - (a.scores.totalPct||0); });

  var html = '<div style="padding:18px 22px;background:#0f1923;color:#e8edf2;border-radius:10px;max-width:980px;margin:32px auto;line-height:1.5">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #2a3848;padding-bottom:10px">';
  html += '<span style="font-size:22px;font-weight:bold">📊 多小区综合对比 <span style="color:#9caab8;font-size:15px">('+list.length+'盘 · 按综合分降序)</span></span>';
  html += '<button onclick="closeCompare()" style="background:#1a2a3a;color:#9caab8;border:1px solid #2a3848;cursor:pointer;font-size:18px;width:32px;height:32px;border-radius:4px">✕</button>';
  html += '</div>';

  // 表头
  html += '<table style="width:100%;border-collapse:collapse;font-size:15px"><tr style="background:#1a2a3a">';
  html += '<th style="padding:10px;text-align:left;color:#9caab8;width:90px;font-size:15px">维度</th>';
  list.forEach(function(item,i){
    var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
    var color = i===0?'#ffa726':i===1?'#4fc3f7':i===2?'#66bb6a':'#9caab8';
    html += '<th style="padding:10px 6px;text-align:center;color:'+color+';font-weight:bold;font-size:17px">'+medal+' '+item.community.name+'</th>';
  });
  html += '</tr>';

  // 价格
  html += '<tr><td style="padding:10px;color:#9caab8;font-size:15px">💰 价格</td>';
  list.forEach(function(item){
    var c=item.community, s=item.scores;
    var g=s.priceGap||0;
    html += '<td style="padding:10px;text-align:center"><b style="color:'+(g<=0?'#66bb6a':'#ffa726')+';font-size:21px">¥'+c.currentPrice+'万</b><br/><span style="font-size:13px;color:'+(g<=0?'#66bb6a':'#ffa726')+'">'+(g<=0?'✅ 已达标':'⚠ 超'+g+'万')+'</span></td>';
  });
  html += '</tr>';

  // 距离行 (统一取距离数字)
  var rows=[
    {label:'🏫 学校',key:'schoolDist',color:'#e040fb',name:s=>s.schoolName+' · '+(s.schoolGrade||'')},
    {label:'🚇 地铁',key:'metro',color:'#29b6f6',name:s=>s.metro?s.metro.name:''},
    {label:'🛒 商圈',key:'mall',color:'#ff7043',name:s=>s.mall?s.mall.name:''},
    {label:'🏥 医院',key:'hospital',color:'#ef5350',name:s=>s.hospital?s.hospital.name:''},
    {label:'🌳 公园',key:'park',color:'#66bb6a',name:s=>s.park?s.park.name:''}
  ];
  rows.forEach(function(row){
    html += '<tr><td style="padding:10px;color:#9caab8;font-size:15px">'+row.label+'</td>';
    list.forEach(function(item){
      var s=item.scores;
      var dist = getDist(s, row.key);
      var bar = Math.max(0,Math.min(100,(1-dist/1500)*100));
      var distStr = dist>=1000 ? (dist/1000).toFixed(1)+'公里' : dist+'米';
      html += '<td style="padding:8px 6px;text-align:center">';
      html += '<div style="display:flex;align-items:center;gap:6px">';
      html += '<div style="flex:1;height:6px;background:#1a2a3a;border-radius:3px">';
      html += '<div style="width:'+bar+'%;height:100%;background:'+row.color+';border-radius:3px"></div>';
      html += '</div>';
      html += '<span style="font-size:15px;font-weight:600;color:'+row.color+';min-width:60px;text-align:right">'+distStr+'</span>';
      html += '</div>';
      if(row.name){
        var n=row.name(s);
        if(n) html += '<div style="font-size:12px;color:#6a7a8a;margin-top:2px;text-align:left">'+n+'</div>';
      }
      html += '</td>';
    });
    html += '</tr>';
  });

  // 综合分
  html += '<tr style="border-top:2px solid #2a3848">';
  html += '<td style="padding:14px;color:#ffa726;font-weight:bold;font-size:17px">⭐ 综合分</td>';
  list.forEach(function(item){
    var pct = item.scores.totalPct||0;
    var color = pct>=75?'#66bb6a':pct>=50?'#ffa726':'#ef5350';
    html += '<td style="padding:14px;text-align:center"><span style="font-size:30px;font-weight:bold;color:'+color+'">'+pct+'</span><span style="font-size:15px;color:#9caab8">/100</span></td>';
  });
  html += '</tr>';

  html += '</table>';
  html += '<div style="margin-top:14px;font-size:12px;color:#6a7a8a;text-align:center;padding-top:10px;border-top:1px solid #2a3848">评分权重: 价格25% + 学校25% + 地铁20% + 商圈10% + 医院10% + 公园10%</div>';
  html += '</div>';

  document.getElementById('comparePanel').innerHTML = html;
  compareModal.style.display = 'block';
};

window.closeCompare = function() {
  if (compareModal) compareModal.style.display = 'none';
};

function updateCheckmarks() {
  document.querySelectorAll('.compare-check').forEach(function(el){
    var name = el.getAttribute('data-community');
    if (selectedIds.indexOf(name) >= 0) {
      el.textContent = '✅'; el.style.background = 'rgba(102,187,106,0.2)';
    } else {
      el.textContent = '➕'; el.style.background = 'transparent';
    }
  });
}

function updateCompareBar() {
  var bar = document.getElementById('compareBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'compareBar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#0f1923;border-top:1px solid #2a3848;padding:10px 16px;z-index:999;display:flex;align-items:center;justify-content:space-between';
    document.body.appendChild(bar);
  }
  if (selectedIds.length === 0) { bar.style.display='none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = '<div style="color:#9caab8;font-size:14px">已选 <b style="color:#ffa726;font-size:18px">'+selectedIds.length+'</b> 盘: ' + selectedIds.map(function(n){
    return '<span style="margin:0 4px;padding:4px 10px;background:#1a2a3a;border-radius:4px;font-size:13px;color:#4fc3f7;cursor:pointer" onclick="toggleCompare(\''+n+'\')">'+n+' ✕</span>';
  }).join('') + '</div>' +
    '<button onclick="openCompare()" style="background:linear-gradient(135deg,#ffa726,#ff7043);color:#fff;border:none;padding:8px 24px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:15px">📊 开始对比</button>';
}

window._dashboardData = [];
window._computeScore = null;
window.refreshCompareData = function(d, computeFn) {
  window._dashboardData = d;
  window._computeScore = computeFn;
};
})();
