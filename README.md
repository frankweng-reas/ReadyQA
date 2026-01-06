# QAPlus - Knowledge Base Management System

> 🚀 企業級知識庫管理系統 (Node.js 重構版本)

## 📋 專案結構

```
qaplus/
├── apps/
│   ├── backend/          # NestJS 後端 API
│   └── frontend/         # Next.js 前端應用
├── packages/
│   ├── shared/           # 共用型別、工具、常數
│   └── tsconfig/         # TypeScript 配置
├── package.json          # Root package.json (Workspaces)
└── turbo.json            # Turborepo 配置
```

## 🛠 技術棧

### 後端
- **NestJS** - 企業級 Node.js 框架
- **Prisma** - 類型安全的 ORM
- **PostgreSQL** - 主資料庫
- **Elasticsearch** - 搜尋引擎
- **TypeScript** - 型別安全

### 前端
- **Next.js 14** - React 框架 (App Router)
- **TypeScript** - 型別安全
- **Tailwind CSS** - 樣式框架
- **Supabase Auth** - 認證服務

### 基礎設施
- **Turborepo** - Monorepo 管理
- **Docker** - 容器化
- **Jest** - 測試框架

## 🚀 快速開始

### 安裝依賴
```bash
npm install
```

### 開發模式（所有專案）
```bash
npm run dev
```

### 建置（所有專案）
```bash
npm run build
```

### 測試（所有專案）
```bash
npm run test
```

### 單獨運行專案
```bash
# 後端
cd apps/backend
npm run dev

# 前端
cd apps/frontend
npm run dev
```

## 📦 套件說明

### `apps/backend`
NestJS 後端 API，提供 RESTful API 服務

- Port: `8000`
- Docs: `/api/docs` (Swagger)

### `apps/frontend`
Next.js 前端應用

- Port: `3000`
- 管理後台與用戶界面

### `packages/shared`
共用程式碼

- 型別定義 (`types/`)
- 工具函數 (`utils/`)
- 常數 (`constants/`)

## 🗄 資料庫設置

### PostgreSQL
```bash
# 使用 Docker 啟動
docker-compose up -d postgres

# 執行 Migration
cd apps/backend
npx prisma migrate dev
```

### Elasticsearch
```bash
# 使用 Docker 啟動
docker-compose up -d elasticsearch
```

## 📝 開發規範

### Commit Message
```
feat: 新功能
fix: 修復問題
docs: 文檔更新
test: 測試相關
refactor: 重構
chore: 雜項
```

### Branch 策略
- `main` - 生產環境
- `develop` - 開發環境
- `feature/*` - 功能分支
- `hotfix/*` - 緊急修復

## 📚 文檔

- [API 分析文件](../answergo/docs/API-ANALYSIS.md)
- [開發指南](./docs/DEVELOPMENT.md) (待建立)
- [部署指南](./docs/DEPLOYMENT.md) (待建立)

## 🧪 測試

```bash
# 單元測試
npm run test

# E2E 測試
npm run test:e2e

# 測試覆蓋率
npm run test:cov
```

## 📊 專案進度

- [x] 階段 0: 專案骨架建立
- [ ] 階段 1: 共用層開發
- [ ] 階段 2: 資料層開發
- [ ] 階段 3: 核心模組開發
- [ ] 階段 4: 進階功能開發

## 🤝 參考專案

本專案重構自 [AnswerGO](../answergo)，原始技術棧為 Python FastAPI。

## 📄 授權

Private

