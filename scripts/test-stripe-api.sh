#!/bin/bash

# Stripe API 測試腳本

echo "🧪 Stripe API 測試"
echo "=========================="
echo ""

# 檢查後端是否運行
if ! curl -s http://localhost:8000/api > /dev/null 2>&1; then
    echo "❌ 後端未運行"
    echo "請先啟動後端："
    echo "  cd apps/backend && npm run dev"
    exit 1
fi

echo "✅ 後端正在運行"
echo ""

# 檢查 Stripe Webhook 是否運行
if ! pgrep -f "stripe listen" > /dev/null; then
    echo "⚠️  Stripe Webhook 轉發未運行"
    echo "請在另一個終端執行："
    echo "  stripe listen --forward-to http://localhost:8000/api/stripe/webhook"
    echo ""
fi

echo "📝 測試選項："
echo ""
echo "1. 測試建立 Checkout Session（需要認證 token）"
echo "2. 測試 Webhook（觸發測試事件）"
echo "3. 檢查 API 端點"
echo ""
read -p "選擇測試項目 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "請提供 Supabase 認證 token："
        read -p "Token: " token
        echo ""
        echo "選擇方案 (starter/pro/enterprise): "
        read -p "Plan Code: " planCode
        echo ""
        echo "發送請求..."
        curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
          -H "Authorization: Bearer $token" \
          -H "Content-Type: application/json" \
          -d "{\"planCode\": \"$planCode\"}" \
          | jq '.' 2>/dev/null || cat
        ;;
    2)
        echo ""
        echo "觸發測試 Webhook 事件..."
        stripe trigger checkout.session.completed
        echo ""
        echo "✅ 檢查後端日誌應該會看到 Webhook 處理訊息"
        ;;
    3)
        echo ""
        echo "檢查 API 端點..."
        echo ""
        echo "GET /api/stripe/create-checkout-session (需要認證)"
        curl -s -o /dev/null -w "狀態碼: %{http_code}\n" http://localhost:8000/api/stripe/create-checkout-session || echo "無法連接"
        echo ""
        echo "POST /api/stripe/webhook (需要 Stripe 簽名)"
        curl -s -X POST http://localhost:8000/api/stripe/webhook \
          -H "Content-Type: application/json" \
          -d '{}' \
          | jq '.' 2>/dev/null || echo "Webhook 需要正確的簽名"
        ;;
    *)
        echo "無效的選擇"
        ;;
esac

echo ""
echo "✅ 測試完成"
