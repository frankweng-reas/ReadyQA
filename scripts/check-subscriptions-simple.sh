#!/bin/bash

# 簡單的訂閱檢查腳本
# 使用 Prisma Studio 查看訂閱狀態

cd /Users/fweng/qaplus/apps/backend

echo "==================================="
echo "檢查訂閱狀態"
echo "==================================="
echo ""
echo "方法1: 使用 Prisma Studio（推薦）"
echo "執行以下命令打開 Prisma Studio："
echo "  cd apps/backend && npx prisma studio"
echo ""
echo "然後在瀏覽器中查看："
echo "  - Subscription 表：檢查有多少筆記錄，status 是什麼"
echo "  - Tenant 表：檢查 planCode 和 stripeCustomerId"
echo ""
echo "==================================="
echo ""
echo "方法2: 使用 API 測試（需要登入後的 token）"
echo "1. 登入系統"
echo "2. 打開瀏覽器開發者工具 > Network"
echo "3. 查看任何 API 請求的 Authorization header"
echo "4. 複製 Bearer token"
echo "5. 執行以下命令（替換 YOUR_TOKEN）："
echo ""
echo "curl -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  http://localhost:8000/api/stripe/debug/subscriptions"
echo ""
echo "==================================="
