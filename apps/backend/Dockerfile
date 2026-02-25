# QAPlus Backend - Production Dockerfile
FROM node:20-alpine AS base

# 安裝依賴階段
FROM base AS deps
WORKDIR /app

# 複製 monorepo 結構
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN npm ci

# 建置階段
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 建置 shared 與 backend（prisma generate 需在 build 前執行，否則 Prisma 型別無法解析）
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma
RUN npm run build -w @qaplus/shared
RUN npm run build -w @qaplus/backend

# 生產階段（Debian slim + OpenSSL，Prisma 需要）
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8000

# 複製必要檔案（backend 使用 workspace 的 node_modules）
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# 建立 uploads 目錄
RUN mkdir -p uploads/chatbot-logos uploads/faq-images

EXPOSE 8000

# 啟動時執行 migration 再啟動服務
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/src/main.js"]
