#!/bin/bash

# 檢查資料庫中的方案是否有正確的 stripePriceId

echo "檢查資料庫中的方案 stripePriceId..."
echo ""

# 使用 psql 查詢（需要設定 DATABASE_URL）
if [ -z "$DATABASE_URL" ]; then
  echo "請設定 DATABASE_URL 環境變數"
  echo "例如: export DATABASE_URL='postgresql://qaplus:password@localhost:5432/qaplus?schema=public'"
  exit 1
fi

psql "$DATABASE_URL" -c "SELECT code, name, \"stripePriceId\", \"priceTwdMonthly\" FROM plans ORDER BY \"priceTwdMonthly\";"

echo ""
echo "如果 stripePriceId 為 NULL，請執行以下 SQL 更新："
echo ""
echo "UPDATE plans SET \"stripePriceId\" = 'price_1Sy31ZK9AZTayzSGRTAAnraV' WHERE code = 'starter';"
echo "UPDATE plans SET \"stripePriceId\" = 'price_1Sy3MbK9AZTayzSGFi27yW0O' WHERE code = 'pro';"
echo "UPDATE plans SET \"stripePriceId\" = 'price_1Sy3WRK9AZTayzSGV0TlB2VF' WHERE code = 'enterprise';"
