#!/bin/bash

# 重新觸發特定的 webhook 事件
# 用於調試 invoice.payment_succeeded 為什麼沒有創建 payment

echo "請從上面的 Stripe CLI 日誌中複製 invoice.payment_succeeded 的 event ID"
echo "格式類似: evt_1Syn9vK9AZTayzSGK1ULGGhX"
echo ""
read -p "輸入 Event ID: " EVENT_ID

if [ -z "$EVENT_ID" ]; then
    echo "錯誤：Event ID 不能為空"
    exit 1
fi

echo ""
echo "重新觸發 event: $EVENT_ID"
echo "==================================="

stripe events resend $EVENT_ID

echo ""
echo "==================================="
echo "完成！請查看："
echo "1. Stripe CLI 的輸出（webhook 回應）"
echo "2. Backend 日誌（處理細節）"
echo "3. 調試頁面（Payment 是否新增）"
