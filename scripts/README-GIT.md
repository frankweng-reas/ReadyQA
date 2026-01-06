# Git 自動化腳本使用說明

## 快速開始

### 方法 1: 簡單腳本（推薦日常使用）

```bash
# 使用自動生成的 commit message
./scripts/git-push.sh

# 或提供自訂的 commit message
./scripts/git-push.sh "feat: 新增某功能"
```

### 方法 2: 智能腳本（推薦重要變更）

```bash
# 會自動分析變更並生成更好的 commit message
# 可以選擇使用自動生成的或輸入自訂的
./scripts/git-push-smart.sh

# 或直接提供 message
./scripts/git-push-smart.sh "feat(chatbot): 改善知識管理功能"
```

### 方法 3: 使用 npm scripts（最方便）

```bash
# 簡單推送
npm run git:push

# 智能推送
npm run git:push:smart

# 或提供自訂 message
npm run git:push -- "你的 commit message"
```

## Commit Message 格式

建議使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 類型

- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文件更新
- `style`: 程式碼格式調整
- `refactor`: 重構
- `perf`: 效能優化
- `test`: 測試相關
- `chore`: 其他變更
- `i18n`: 翻譯更新

### 範例

```bash
# 新功能
feat(chatbot): 新增知識管理功能

# 修復
fix(modal): 修正全螢幕顯示問題

# 改善
feat(ui): 改善 topic 順序調整 UI

# 翻譯
i18n: 更新繁體中文翻譯
```

## Git Commit Template

已設定 git commit template，使用 `git commit` 時會自動載入範本：

```bash
git commit  # 會開啟編輯器顯示 template
```

## 進階使用

### 只提交特定檔案

```bash
git add apps/frontend/src/components/chatbot/FaqModal.tsx
./scripts/git-push.sh "fix: 修正 modal 全螢幕問題"
```

### 查看變更

```bash
git status
git diff
```

### 修改最後一次 commit

```bash
git commit --amend -m "新的 message"
git push --force-with-lease
```

## 注意事項

1. 腳本會自動添加所有變更（`git add .`）
2. 如果沒有變更，腳本會自動退出
3. 推送失敗時會顯示錯誤訊息
4. 建議在推送前先檢查變更內容

