#!/bin/bash

source /Users/fweng/qaplus/.env.local

echo "==================================="
echo "檢查訂閱狀態"
echo "==================================="
echo ""

docker exec qaplus-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
  s.id,
  s.\"tenantId\",
  s.\"stripeSubscriptionId\",
  s.\"planCode\",
  s.status,
  s.\"createdAt\"
FROM subscriptions s
WHERE s.status IN ('active', 'trialing')
ORDER BY s.\"createdAt\" DESC;
"

echo ""
echo "==================================="
echo "如果看到多個 active 訂閱，就是問題"
echo "==================================="
