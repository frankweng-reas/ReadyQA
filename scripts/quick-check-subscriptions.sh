#!/bin/bash

# 快速檢查訂閱狀態
echo "==================================="
echo "檢查訂閱狀態"
echo "==================================="

# 加載環境變數
source /Users/fweng/qaplus/.env.local

cd /Users/fweng/qaplus/apps/backend

# 使用 Prisma CLI 直接查詢
echo ""
echo "執行查詢..."
echo ""

npx prisma db execute --stdin <<SQL
SELECT 
  s.id,
  s."tenantId",
  s."stripeSubscriptionId",
  s."planCode",
  s.status,
  s."createdAt",
  t."planCode" as "tenant_planCode"
FROM subscriptions s
LEFT JOIN tenants t ON s."tenantId" = t.id
WHERE s.status IN ('active', 'trialing')
ORDER BY s."createdAt" DESC;
SQL

echo ""
echo "==================================="
echo "如果看到多個 active 訂閱，就是問題所在"
echo "===================================" 
