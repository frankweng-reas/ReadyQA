#!/bin/bash

# Stripe 完整測試腳本

echo "🧪 Stripe 金流完整測試"
echo "=========================="
echo ""

# 檢查服務狀態
echo "📊 檢查服務狀態："
echo ""

# 檢查後端
if curl -s http://localhost:8000/api > /dev/null 2>&1; then
    echo "  ✅ 後端正在運行 (http://localhost:8000)"
else
    echo "  ❌ 後端未運行"
    echo "  請先啟動：cd apps/backend && npm run dev"
    exit 1
fi

# 檢查 Stripe Webhook
if pgrep -f "stripe listen" > /dev/null; then
    echo "  ✅ Stripe Webhook 轉發正在運行"
else
    echo "  ⚠️  Stripe Webhook 轉發未運行"
    echo "  請在另一個終端執行：stripe listen --forward-to http://localhost:8000/api/stripe/webhook"
    echo ""
    read -p "是否繼續測試？(y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "=========================="
echo ""

# 測試選項
echo "選擇測試項目："
echo ""
echo "1. 測試 Webhook（觸發測試事件，不需要認證）"
echo "2. 測試建立 Checkout Session（需要 Supabase token）"
echo "3. 測試訂閱更新事件"
echo "4. 測試訂閱取消事件"
echo "5. 查看資料庫狀態"
echo ""
read -p "請選擇 (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🔄 觸發 checkout.session.completed 事件..."
        echo ""
        stripe trigger checkout.session.completed
        echo ""
        echo "✅ 事件已觸發"
        echo ""
        echo "📝 請檢查："
        echo "  1. Stripe Webhook 終端應該顯示事件轉發"
        echo "  2. 後端日誌應該顯示 Webhook 處理訊息"
        echo "  3. 資料庫 subscriptions 表應該有新記錄"
        ;;
    2)
        echo ""
        echo "📝 測試建立 Checkout Session"
        echo ""
        echo "這個測試需要 Supabase 認證 token"
        echo ""
        echo "取得 token 的方法："
        echo "  1. 登入前端應用 (http://localhost:3000)"
        echo "  2. 打開瀏覽器開發者工具 (F12)"
        echo "  3. Console 執行："
        echo "     const { createClient } = await import('/src/lib/supabase/client');"
        echo "     const supabase = createClient();"
        echo "     const { data } = await supabase.auth.getSession();"
        echo "     console.log(data.session.access_token);"
        echo ""
        read -p "請輸入 Supabase token: " token
        echo ""
        read -p "選擇方案 (starter/pro/enterprise): " planCode
        echo ""
        echo "發送請求..."
        echo ""
        response=$(curl -s -X POST http://localhost:8000/api/stripe/create-checkout-session \
          -H "Authorization: Bearer $token" \
          -H "Content-Type: application/json" \
          -d "{\"planCode\": \"$planCode\"}")
        
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        echo ""
        
        # 提取 URL
        url=$(echo "$response" | jq -r '.data.url' 2>/dev/null)
        if [[ -n "$url" && "$url" != "null" ]]; then
            echo "✅ Checkout Session 建立成功！"
            echo ""
            echo "🔗 Checkout URL: $url"
            echo ""
            echo "💡 提示："
            echo "  1. 訪問上面的 URL 進行測試付款"
            echo "  2. 使用測試卡號：4242 4242 4242 4242"
            echo "  3. 任何未來日期和 CVC"
            echo "  4. 付款完成後，Webhook 會自動更新資料庫"
        fi
        ;;
    3)
        echo ""
        echo "🔄 觸發 customer.subscription.updated 事件..."
        echo ""
        stripe trigger customer.subscription.updated
        echo ""
        echo "✅ 事件已觸發"
        echo ""
        echo "📝 請檢查後端日誌和資料庫"
        ;;
    4)
        echo ""
        echo "🔄 觸發 customer.subscription.deleted 事件..."
        echo ""
        stripe trigger customer.subscription.deleted
        echo ""
        echo "✅ 事件已觸發"
        echo ""
        echo "📝 請檢查後端日誌和資料庫"
        ;;
    5)
        echo ""
        echo "📊 查詢資料庫狀態..."
        echo ""
        cd apps/backend
        DATABASE_URL="postgresql://qaplus:password@localhost:5432/qaplus?schema=public" node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        (async () => {
          console.log('📋 Subscriptions:');
          const subs = await prisma.subscription.findMany({ 
            orderBy: { createdAt: 'desc' },
            take: 5 
          });
          subs.forEach(s => {
            console.log(\`  - \${s.id.substring(0, 20)}... | \${s.planCode} | \${s.status} | Tenant: \${s.tenantId}\`);
          });
          
          console.log('');
          console.log('📋 Tenants (最近 5 個):');
          const tenants = await prisma.tenant.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 5,
            include: { plan: { select: { code: true, name: true } } }
          });
          tenants.forEach(t => {
            console.log(\`  - \${t.id} | Plan: \${t.planCode} (\${t.plan.name}) | Status: \${t.status}\`);
          });
          
          await prisma.\$disconnect();
        })();
        " 2>&1
        ;;
    *)
        echo "無效的選擇"
        ;;
esac

echo ""
echo "=========================="
echo "✅ 測試完成"
