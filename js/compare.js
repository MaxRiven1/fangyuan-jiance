// 购房对比系统 - 独立模块
(function() {
'use strict';

var selectedIds = [];
var compareModal = null;

// 创建对比modal容器
function ensureModal() {
  if (compareModal) return;
  compareModal = document.createElement('div');
  compareModal.id = 'compareModal';
  compareModal.innerHTML = '<div class="compare-overlay" onclick="closeCompare()"></div><div class="compare-panel" id="comparePanel"></div>';
  document.body.appendChild(compareModal);
}

// 选中/取消小区
window.toggleCompare = function(name) {
  var idx = selectedIds.indexOf(name);
  if (idx >= 0) { selectedIds.splice(idx,1); } 
  else if (selectedIds.length < 5) { selectedIds.push(name); }
  else { return; }
  updateCheckmarks();
  updateCompareBar();
};

// 打开对比
window.openCompare = function() {
  if (selectedIds.length < 2) return;
  ensureModal();
  var list = selectedIds.map(function(n) { 
    var c = (window._dashboardData||[]).find(function(x) { return x.name === n; });
    return c ? { community:c, scores:window._computeScore(c) } : null;
  }).filter(Boolean);
  if (list.length < 2) return;
  
  var html = '<div style="padding:16px 20px;background:#0f1923;color:#e8edf2;border-radius:8px;max-width:900px;margin:40px auto">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  html += '<span style="font-size:16px;font-weight:bold">📊 多小区综合对比 ('+list.length+'盘)</span>';
  html += '<button onclick="closeCompare()" style="background:none;border:none;color:#9caab8;cursor:pointer;font-size:18px">✕</button>';
  html += '</div>';
  
  // 表头
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px"><tr style="background:#1a2a3a">';
  html += '<th style="padding:8px;text-align:left;color:#9caab8;width:100px">维度</th>';
  list.forEach(function(item,i){
    html += '<th style="padding:8px;text-align:center;color:'+getRankColor(i)+';font-weight:bold">#'+(i+1)+' '+item.community.name+'</th>';
  });
  html += '</tr>';
  
  // 价格行
  html += '<tr>';
  html += '<td style="padding:6px 8px;color:#9caab8">💰 价格</td>';
  list.forEach(function(item){
    var c=item.community, s=item.scores;
    html += '<td style="padding:6px;text-align:center"><b style="color:'+(s.priceGap<=0?'#66bb6a':'#ffa726')+'">¥'+c.currentPrice+'万</b><br/><span style="font-size:9px;color:'+(s.priceGap<=0?'#66bb6a':'#ffa726')+'">'+(s.priceGap<=0?'已达标':'超'+s.priceGap+'万')+'</span></td>';
  });
  html += '</tr>';
  
  // 各维度行
  var rows=[
    {label:'🏫 学校',key:'schoolDist',unit:'米',color:'#e040fb'},
    {label:'🚇 地铁',key:'metro',unit:'米',color:'#29b6f6'},
    {label:'🛒 商圈',key:'mall',unit:'米',color:'#ff7043'},
    {label:'🏥 医院',key:'hospital',unit:'米',color:'#ef5350'},
    {label:'🌳 公园',key:'park',unit:'米',color:'#66bb6a'}
  ];
  rows.forEach(function(row){
    html += '<tr>';
    html += '<td style="padding:6px 8px;color:#9caab8">'+row.label+'</td>';
    list.forEach(function(item){
      var s=item.scores[row.key];
      var dist = s ? s.dist : 9999;
      var bar = Math.max(0,Math.min(100,(1-dist/1500)*100));
      html += '<td style="padding:4px 6px;text-align:center"><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:4px;background:#1a2a3a;border-radius:2px"><div style="width:'+bar+'%;height:100%;background:'+row.color+';border-radius:2px"></div></div><span style="font-size:10px;font-weight:600;color:'+row.color+'">'+dist+'米</span></div></td>';
    });
    html += '</tr>';
  });
  
  // 综合得分行
  html += '<tr style="border-top:2px solid #2a3848">';
  html += '<td style="padding:8px;color:#ffa726;font-weight:bold">⭐ 综合分</td>';
  list.forEach(function(item){
    html += '<td style="padding:8px;text-align:center"><span style="font-size:20px;font-weight:bold;color:'+getScoreColor(item.scores.totalPct)+'">'+item.scores.totalPct+'</span><span style="font-size:11px;color:#9caab8">/100</span></td>';
  });
  html += '</tr>';
  
  html += '</table>';
  html += '<div style="margin-top:12px;font-size:10px;color:#6a7a8a;text-align:center">评分权重: 价格25% + 学校25% + 地铁20% + 商圈10% + 医院10% + 公园10%</div>';
  html += '</div>';
  
  document.getElementById('comparePanel').innerHTML = html;
  compareModal.style.display = 'block';
};

window.closeCompare = function() {
  if (compareModal) compareModal.style.display = 'none';
};

function getRankColor(i) { return i===0?'#ffa726':i===1?'#4fc3f7':i===2?'#66bb6a':'#9caab8'; }
function getScoreColor(s) { return s>=75?'#66bb6a':s>=50?'#ffa726':'#ef5350'; }

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
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#0f1923;border-top:1px solid #2a3848;padding:8px 16px;z-index:999;display:flex;align-items:center;justify-content:space-between';
    document.body.appendChild(bar);
  }
  if (selectedIds.length === 0) { bar.style.display='none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = '<div style="color:#9caab8;font-size:12px">已选 <b style="color:#ffa726">'+selectedIds.length+'</b> 盘: ' + selectedIds.map(function(n,i){ return '<span style="margin:0 4px;padding:2px 8px;background:#1a2a3a;border-radius:3px;font-size:11px;color:#4fc3f7;cursor:pointer" onclick="toggleCompare(\''+n+'\')">'+n+' ✕</span>'; }).join('') + '</div>' +
    '<button onclick="openCompare()" style="background:linear-gradient(135deg,#ffa726,#ff7043);color:#fff;border:none;padding:6px 20px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:13px">📊 开始对比</button>';
}

// 暴露helpers给renderLeft用
window._dashboardData = [];
window._computeScore = null;
window.refreshCompareData = function(d, computeFn) {
  window._dashboardData = d;
  window._computeScore = computeFn;
};
})();
