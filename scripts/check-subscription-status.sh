#!/bin/bash

# 檢查訂閱狀態

echo "檢查訂閱狀態..."
echo ""

# 使用 psql 查詢（需要設定 DATABASE_URL）
if [ -z "$DATABASE_URL" ]; then
  echo "請設定 DATABASE_URL 環境變數"
  echo "例如: export DATABASE_URL='postgresql://qaplus:password@localhost:5432/qaplus?schema=public'"
  exit 1
fi

echo "=== Subscription 記錄 ==="
psql "$DATABASE_URL" -c "SELECT id, \"tenantId\", \"stripeSubscriptionId\", \"planCode\", status, \"cancelAtPeriodEnd\", \"canceledAt\", \"currentPeriodEnd\", \"updatedAt\" FROM subscriptions ORDER BY \"updatedAt\" DESC LIMIT 5;"

echo ""
echo "=== Tenant 方案 ==="
psql "$DATABASE_URL" -c "SELECT id, name, \"planCode\" FROM tenants ORDER BY \"updatedAt\" DESC LIMIT 5;"
