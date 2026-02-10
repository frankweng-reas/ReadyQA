#!/bin/bash

# 檢查 Stripe Price 是否為 recurring 類型

echo "檢查 Stripe Price 設定..."
echo ""

if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "請設定 STRIPE_SECRET_KEY 環境變數"
  exit 1
fi

echo "檢查 Price IDs..."
echo ""

# 從 .env.local 讀取 Price IDs
PRICE_IDS=(
  "price_1Sy31ZK9AZTayzSGRTAAnraV"  # starter
  "price_1Sy3MbK9AZTayzSGFi27yW0O"  # pro
  "price_1Sy3WRK9AZTayzSGV0TlB2VF"  # enterprise
)

for price_id in "${PRICE_IDS[@]}"; do
  echo "檢查 $price_id..."
  stripe prices retrieve "$price_id" --format json | jq -r '
    "  ID: \(.id)",
    "  Type: \(.type)",
    "  Recurring: \(if .recurring then "Yes (\(.recurring.interval))" else "No ❌" end)",
    "  Amount: \(.unit_amount / 100) \(.currency)",
    ""
  '
done

echo ""
echo "如果 Recurring 顯示 'No ❌'，請在 Stripe Dashboard 中："
echo "1. 前往 Products > 找到對應的 Product"
echo "2. 編輯 Price"
echo "3. 確保 'Billing period' 設定為 'Monthly' 或 'Yearly'（不是 'One time'）"
echo "4. 或刪除舊的 Price，建立新的 Recurring Price"
