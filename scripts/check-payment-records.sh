#!/bin/bash

# 檢查資料庫中的 Payment 記錄

echo "檢查資料庫中的 Payment 記錄..."
echo ""

# 使用 psql 查詢（需要設定 DATABASE_URL）
if [ -z "$DATABASE_URL" ]; then
  echo "請設定 DATABASE_URL 環境變數"
  echo "例如: export DATABASE_URL='postgresql://qaplus:password@localhost:5432/qaplus?schema=public'"
  exit 1
fi

echo "=== Payment 記錄 ==="
psql "$DATABASE_URL" -c "SELECT id, \"subscriptionId\", \"tenantId\", amount, currency, status, \"stripePaymentIntentId\", \"stripeInvoiceId\", \"paidAt\", \"createdAt\" FROM payments ORDER BY \"createdAt\" DESC LIMIT 10;"

echo ""
echo "=== Subscription 記錄 ==="
psql "$DATABASE_URL" -c "SELECT id, \"tenantId\", \"stripeSubscriptionId\", \"planCode\", status, \"currentPeriodStart\", \"currentPeriodEnd\" FROM subscriptions ORDER BY \"createdAt\" DESC LIMIT 10;"
