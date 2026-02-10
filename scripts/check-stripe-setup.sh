#!/bin/bash

# 檢查 Stripe 設定狀態的腳本

echo "🔍 檢查 Stripe 設定狀態"
echo "=========================="
echo ""

# 檢查環境變數
echo "📝 環境變數檢查："
echo ""

check_env_var() {
    if grep -q "^$1=" .env.local 2>/dev/null; then
        value=$(grep "^$1=" .env.local | cut -d'=' -f2- | tr -d '"' | tr -d "'")
        if [[ "$value" == *"your"* ]] || [[ "$value" == *"here"* ]] || [[ -z "$value" ]]; then
            echo "  ❌ $1 - 未設定或使用預設值"
            return 1
        else
            echo "  ✅ $1 - 已設定"
            return 0
        fi
    else
        echo "  ❌ $1 - 未找到"
        return 1
    fi
}

cd /Users/fweng/qaplus

check_env_var "STRIPE_SECRET_KEY"
check_env_var "STRIPE_WEBHOOK_SECRET"
check_env_var "STRIPE_PRICE_ID_STARTER"
check_env_var "STRIPE_PRICE_ID_PRO"
check_env_var "STRIPE_PRICE_ID_ENTERPRISE"
check_env_var "FRONTEND_URL"

echo ""
echo "📊 資料庫檢查："
echo ""

# 檢查資料庫連線和 plans 表
cd apps/backend
DATABASE_URL="postgresql://qaplus:password@localhost:5432/qaplus?schema=public" npx prisma db execute --stdin <<'SQL' 2>&1 | grep -E "code|name|stripePriceId|free|starter|pro|enterprise" || echo "  需要檢查資料庫連線"
SELECT code, name, "stripePriceId" FROM plans;
SQL

echo ""
echo "✅ 檢查完成！"
echo ""
echo "📋 待辦事項："
echo ""
echo "1. 確認資料庫 plans 表的 stripePriceId 已更新"
echo "2. 啟動後端：cd apps/backend && npm run dev"
echo "3. 啟動 Stripe Webhook：stripe listen --forward-to http://localhost:8000/api/stripe/webhook"
echo "4. 測試 API：curl -X POST http://localhost:8000/api/stripe/create-checkout-session ..."
echo ""
