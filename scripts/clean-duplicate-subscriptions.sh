#!/bin/bash

# 清理重複的訂閱和支付記錄

source /Users/fweng/qaplus/.env.local

echo "==================================="
echo "清理重複的訂閱記錄"
echo "==================================="
echo ""

# 1. 查看當前狀態
echo "1. 當前 active 訂閱："
docker exec qaplus-postgres psql -U postgres -d qaplus -c "
SELECT id, \"tenantId\", \"planCode\", status, \"createdAt\"
FROM subscriptions 
WHERE status IN ('active', 'trialing')
ORDER BY \"createdAt\" DESC;
"

echo ""
echo "2. 當前 payment 記錄："
docker exec qaplus-postgres psql -U postgres -d qaplus -c "
SELECT id, amount, currency, status, \"createdAt\"
FROM payments 
ORDER BY \"createdAt\" DESC
LIMIT 10;
"

echo ""
echo "==================================="
echo "如果有多個 active 訂閱，請執行以下SQL："
echo ""
echo "-- 保留最新的，將舊的改為 canceled"
echo "UPDATE subscriptions"
echo "SET status = 'canceled', \"canceledAt\" = NOW()"
echo "WHERE id IN ("
echo "  SELECT id FROM subscriptions"
echo "  WHERE status = 'active' AND \"tenantId\" = 'YOUR_TENANT_ID'"
echo "  ORDER BY \"createdAt\" DESC"
echo "  OFFSET 1"
echo ");"
echo ""
echo "==================================="
