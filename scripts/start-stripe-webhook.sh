#!/bin/bash

# 快速啟動 Stripe Webhook 轉發腳本
# 使用前請確保已經執行過 stripe login

set -e

echo "🔄 啟動 Stripe Webhook 轉發..."
echo ""
echo "轉發目標: http://localhost:8000/api/stripe/webhook"
echo ""
echo "⚠️  請複製下面顯示的 'whsec_...' 值到 .env.local"
echo "按 Ctrl+C 停止"
echo ""
echo "=========================="
echo ""

stripe listen --forward-to http://localhost:8000/api/stripe/webhook
