#!/bin/bash

# Git 自動提交與推送腳本
# 使用方法: ./scripts/git-push.sh [commit message]

set -e

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查是否在 git repository 中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}錯誤: 不在 git repository 中${NC}"
    exit 1
fi

# 檢查是否有遠端設定
if ! git remote get-url origin > /dev/null 2>&1; then
    echo -e "${YELLOW}警告: 未設定遠端 origin，請先設定:${NC}"
    echo "git remote add origin https://github.com/your-username/your-repo.git"
    exit 1
fi

# 顯示當前狀態
echo -e "${GREEN}=== Git 狀態 ===${NC}"
git status --short

# 檢查是否有變更
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}沒有變更需要提交${NC}"
    exit 0
fi

# 獲取 commit message
if [ -z "$1" ]; then
    # 如果沒有提供 message，自動生成
    echo -e "${YELLOW}未提供 commit message，使用自動生成...${NC}"
    
    # 分析變更類型
    CHANGED_FILES=$(git diff --cached --name-only 2>/dev/null || git status --porcelain | awk '{print $2}')
    
    # 簡單的變更類型判斷
    if echo "$CHANGED_FILES" | grep -q "\.tsx\|\.ts"; then
        TYPE="feat"
        SCOPE="frontend"
    elif echo "$CHANGED_FILES" | grep -q "backend"; then
        TYPE="feat"
        SCOPE="backend"
    else
        TYPE="chore"
        SCOPE=""
    fi
    
    # 生成簡單的 message
    COMMIT_MSG="${TYPE}${SCOPE:+(${SCOPE}): }更新程式碼"
else
    COMMIT_MSG="$1"
fi

# 添加所有變更
echo -e "${GREEN}=== 添加變更 ===${NC}"
git add .

# 提交
echo -e "${GREEN}=== 提交變更 ===${NC}"
echo "Commit message: ${COMMIT_MSG}"
git commit -m "$COMMIT_MSG"

# 獲取當前分支
CURRENT_BRANCH=$(git branch --show-current)

# 推送到遠端
echo -e "${GREEN}=== 推送到 GitHub ===${NC}"
if git push -u origin "$CURRENT_BRANCH" 2>/dev/null || git push origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}✓ 成功推送到 GitHub${NC}"
    echo -e "${GREEN}分支: ${CURRENT_BRANCH}${NC}"
else
    echo -e "${RED}✗ 推送失敗${NC}"
    exit 1
fi

