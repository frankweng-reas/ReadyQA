# QAPlus 快速啟動指南

## 📦 安裝依賴

```bash
# 在專案根目錄
cd /Users/fweng/qaplus
npm install
```

這會安裝所有 workspace 的依賴。

---

## 🐳 啟動資料庫

```bash
# 啟動 PostgreSQL 和 Elasticsearch
docker-compose up -d

# 檢查狀態
docker-compose ps

# 停止
docker-compose down
```

---

## 🚀 開發模式

### 選項 1: 使用 Turborepo (推薦)
同時啟動前後端：
```bash
npm run dev
```

### 選項 2: 分別啟動

#### 後端
```bash
cd apps/backend
npm install
npm run dev
```
訪問: http://localhost:8000/api  
API 文檔: http://localhost:8000/api/docs

#### 前端
```bash
cd apps/frontend
npm install
npm run dev
```
訪問: http://localhost:3000

---

## 🧪 測試

```bash
# 所有測試
npm run test

# 單一專案測試
cd apps/backend
npm run test

# 測試覆蓋率
npm run test:cov
```

---

## 🏗 建置

```bash
# 建置所有專案
npm run build

# 單一專案建置
cd apps/backend
npm run build
```

---

## 📝 常用指令

```bash
# Lint 檢查
npm run lint

# 清理建置檔案
npm run clean

# 查看專案結構
tree -L 3 -I 'node_modules|.next|dist'
```

---

## 🔧 環境變數設定

### Backend
複製範例檔案：
```bash
cd apps/backend
cp env.example .env.local
```

編輯 `.env.local`，設定必要的環境變數。

### Frontend
```bash
cd apps/frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
```

---

## 📚 下一步

1. ✅ 專案已建立完成
2. 📖 閱讀 [階段 0 檢查清單](./docs/STAGE-0-CHECKLIST.md)
3. 🚀 開始 [階段 1: 共用層開發](./docs/STAGE-1-GUIDE.md)

---

## ❓ 常見問題

### Q: Turborepo 啟動失敗？
A: 確保每個 workspace 都已安裝依賴：
```bash
npm install
cd apps/backend && npm install
cd ../frontend && npm install
```

### Q: 資料庫連接失敗？
A: 檢查 Docker 是否正常運行：
```bash
docker-compose ps
docker-compose logs postgres
```

### Q: TypeScript 編譯錯誤？
A: 確保 shared package 已建置：
```bash
cd packages/shared
npm run build
```

---

## 🆘 需要幫助？

查看詳細文檔：
- [API 分析文件](docs/API-ANALYSIS.md)
- [專案 README](./README.md)
- [階段 0 檢查清單](./docs/STAGE-0-CHECKLIST.md)

