# QAPlus Frontend - Production Dockerfile
# NEXT_PUBLIC_* 需在 build 時傳入（build-arg）
FROM node:20-alpine AS base

# 安裝依賴階段
FROM base AS deps
WORKDIR /app

# 需複製所有 workspace 的 package.json，npm ci 才能正確解析依賴
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/

RUN npm ci

# 建置階段
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY . .
# 在 builder 重新 npm ci，確保 monorepo 依賴正確解析（next-intl 等）
RUN npm ci

RUN npm run build -w @qaplus/shared
RUN npm run build -w @qaplus/frontend

# 生產階段（使用 next start，monorepo 相容性佳）
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/frontend ./apps/frontend
COPY --from=builder /app/packages/shared ./packages/shared

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@qaplus/frontend"]
