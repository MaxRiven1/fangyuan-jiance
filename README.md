# 房源监测 · 数智看板

成都学区房实时监测看板 — 金牛/青羊/成华三区 14 所目标小学对口小区价格变动监控。

## 在线预览地址

https://8080-ad9df3dc22372080.monkeycode-ai.online

## 技术栈
- 高德地图 JS API 2.0（2D地图 + 标记）
- 纯前端静态页面（HTML + CSS + Vanilla JS）
- 数据从 `data/dashboard-data.json` 加载，每30分钟自动轮询

## 目录结构
```
├── index.html              # 看板主页面
├── config.js               # 配置文件（高德Key等）
├── css/
│   └── dashboard.css       # 看板样式
├── js/
│   └── dashboard.js        # 看板核心逻辑（地图/面板/轮询）
├── data/
│   └── dashboard-data.json # 看板数据（由自动化脚本生成）
└── scripts/
    ├── generate_dashboard_data.js  # 每日生成看板数据
    └── git_sync.sh                 # Git同步脚本
```

## 部署方式（MonkeyCode）
直接部署整个文件夹为静态站点，入口 `index.html`。

## 数据更新流程
1. 每日9:00 学区房监测自动化拉取贝壳数据
2. `generate_dashboard_data.js` 读取小区池 → 生成 `dashboard-data.json`
3. `git_sync.sh` commit + push 到 GitHub
4. 看板轮询加载最新数据

## 数据来源
- 贝壳网(cd.ke.com) 登录状态实抓
- 套三双卫/套二单卫两套监测池，共15个小区
- 14所目标小学：青羊7 + 金牛3 + 成华4
