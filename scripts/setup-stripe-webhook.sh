#!/bin/bash

# Stripe Webhook 設定腳本
# 這個腳本會幫助你設定 Stripe CLI 並啟動 Webhook 轉發

set -e

echo "🚀 Stripe Webhook 設定腳本"
echo "=========================="
echo ""

# 檢查 Stripe CLI 是否已安裝
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI 未安裝"
    echo "正在安裝 Stripe CLI..."
    brew install stripe/stripe-cli/stripe
else
    echo "✅ Stripe CLI 已安裝: $(stripe --version)"
fi

echo ""
echo "📝 步驟 1: 登入 Stripe CLI"
echo "這會開啟瀏覽器讓你授權..."
echo ""
read -p "按 Enter 繼續..."

# 執行 stripe login（會開啟瀏覽器）
stripe login

echo ""
echo "✅ 登入完成！"
echo ""
echo "📝 步驟 2: 啟動 Webhook 轉發"
echo ""
echo "請確保後端伺服器正在運行在 http://localhost:8000"
echo ""
read -p "後端是否已啟動？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "請先啟動後端："
    echo "  cd apps/backend"
    echo "  npm run dev"
    echo ""
    exit 1
fi

echo ""
echo "🔄 正在啟動 Stripe Webhook 轉發..."
echo ""
echo "⚠️  重要："
echo "1. 複製下面顯示的 'whsec_...' 值"
echo "2. 更新 .env.local 中的 STRIPE_WEBHOOK_SECRET"
echo "3. 重啟後端伺服器"
echo ""
echo "按 Ctrl+C 停止 Webhook 轉發"
echo ""
echo "=========================="
echo ""

# 啟動 stripe listen
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
