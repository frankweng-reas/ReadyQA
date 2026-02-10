#!/bin/bash

# 更新訂閱的付款方式為失敗測試卡
# 使用方法：./update-to-failed-card.sh <customer_id>

CUSTOMER_ID=$1

if [ -z "$CUSTOMER_ID" ]; then
  echo "❌ 請提供 Customer ID"
  echo "使用方法: ./update-to-failed-card.sh cus_xxx"
  exit 1
fi

echo "========== 更新付款方式為失敗測試卡 =========="
echo "Customer ID: $CUSTOMER_ID"
echo ""

# 1. 創建失敗的付款方式（使用實際的失敗卡號）
echo "1. 創建失敗的付款方式..."
PM_ID=$(stripe payment_methods create \
  --type=card \
  --card[number]=4000000000000002 \
  --card[exp_month]=12 \
  --card[exp_year]=2025 \
  --card[cvc]=123 \
  2>&1 | grep '"id"' | head -1 | cut -d'"' -f4)

if [ -z "$PM_ID" ]; then
  echo "❌ 創建付款方式失敗"
  exit 1
fi

echo "✅ 付款方式 ID: $PM_ID"
echo ""

# 2. 附加到 customer
echo "2. 附加付款方式到 customer..."
stripe payment_methods attach $PM_ID --customer=$CUSTOMER_ID
echo "✅ 已附加"
echo ""

# 3. 設為預設付款方式
echo "3. 設為預設付款方式..."
stripe customers update $CUSTOMER_ID \
  --invoice_settings[default_payment_method]=$PM_ID
echo "✅ 已設為預設"
echo ""

# 4. 驗證
echo "4. 驗證更新..."
stripe customers retrieve $CUSTOMER_ID --expand=invoice_settings.default_payment_method | grep -A 5 "default_payment_method"
echo ""

echo "========== 完成 =========="
echo "✅ 付款方式已更新為失敗測試卡 (4000000000000002)"
echo "⏰ 下次 Stripe 嘗試收款時會失敗"
echo "📡 Stripe 會自動發送 invoice.payment_failed webhook"
