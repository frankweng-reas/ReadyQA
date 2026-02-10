#!/bin/bash

# 取得 Stripe Webhook Secret 的腳本
# 這個腳本會啟動 stripe listen 並自動提取 webhook secret

set -e

echo "🔍 取得 Stripe Webhook Secret"
echo "=========================="
echo ""

# 檢查是否已登入
if ! stripe config --list &> /dev/null; then
    echo "❌ 尚未登入 Stripe CLI"
    echo ""
    echo "請先執行："
    echo "  stripe login"
    echo ""
    echo "這會開啟瀏覽器讓你授權"
    exit 1
fi

echo "✅ Stripe CLI 已登入"
echo ""
echo "📝 請按照以下步驟操作："
echo ""
echo "1. 確保後端正在運行："
echo "   cd apps/backend && npm run dev"
echo ""
echo "2. 在新的終端執行："
echo "   stripe listen --forward-to http://localhost:8000/api/stripe/webhook"
echo ""
echo "3. 複製顯示的 'whsec_...' 值"
echo ""
echo "4. 更新 .env.local："
echo "   STRIPE_WEBHOOK_SECRET=whsec_你的值"
echo ""
echo "5. 重啟後端伺服器"
echo ""
echo "=========================="
echo ""

# 嘗試啟動並提取 secret（這會持續運行，所以我們只顯示指引）
echo "💡 提示：執行以下命令來啟動 Webhook 轉發並取得 Secret："
echo ""
echo "   stripe listen --forward-to http://localhost:8000/api/stripe/webhook"
echo ""
echo "你會看到類似這樣的輸出："
echo "   > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx"
echo ""
echo "複製 whsec_... 的值到 .env.local"
