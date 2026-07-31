#!/bin/bash
# 房源监测 Git 同步脚本
# 每日9AM自动化拉取数据后执行：生成看板数据 → commit → push
# 集成到学区房监测自动化任务末尾
#
# 用法：bash git_sync.sh [日期:2026-07-31]

set -e
DATE="${1:-$(date +%Y-%m-%d)}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="C:/Users/11658/.workbuddy/binaries/node/versions/22.22.2/node.exe"

echo "=== 房源监测 Git 同步: ${DATE} ==="

# 1. 生成看板数据
cd "$ROOT_DIR/scripts"
echo "[1/3] 生成 dashboard-data.json..."
"$NODE" generate_dashboard_data.js "$DATE"

# 2. 复制数据到 Git 目录（已在房源监测/data下，无需额外操作）
cd "$ROOT_DIR"

# 3. Git add + commit + push
echo "[2/3] Git add & commit..."
git add data/dashboard-data.json
git add -A
git commit -m "data: ${DATE} 每日看板数据更新" || echo "⚠️ 无变更可提交"

echo "[3/3] Git push..."
git push origin main 2>&1 || echo "⚠️ Push失败（请检查远程仓库配置和网络）"

echo "=== 同步完成 ==="
