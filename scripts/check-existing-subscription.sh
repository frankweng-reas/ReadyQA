#!/bin/bash
source .env.local

echo "Checking existing subscriptions..."
docker exec qaplus-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" << SQL
SELECT 
  s.id,
  s."tenantId",
  s."stripeSubscriptionId",
  s."planCode",
  s.status,
  s."createdAt"
FROM subscriptions s
ORDER BY s."createdAt" DESC
LIMIT 10;
SQL
