#!/bin/bash

# 智能 Git 提交與推送腳本
# 會自動分析變更並生成更好的 commit message
# 使用方法: ./scripts/git-push-smart.sh [可選的自訂 message]

set -e

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 檢查是否在 git repository 中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}錯誤: 不在 git repository 中${NC}"
    exit 1
fi

# 檢查是否有遠端設定
if ! git remote get-url origin > /dev/null 2>&1; then
    echo -e "${YELLOW}警告: 未設定遠端 origin${NC}"
    exit 1
fi

# 顯示當前狀態
echo -e "${BLUE}=== Git 狀態 ===${NC}"
git status --short

# 檢查是否有變更
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}沒有變更需要提交${NC}"
    exit 0
fi

# 分析變更
echo -e "${BLUE}=== 分析變更 ===${NC}"
CHANGED_FILES=$(git status --porcelain | awk '{print $2}')

# 判斷變更類型
TYPE="chore"
SCOPE=""
DESC=""

# 檢查檔案類型
if echo "$CHANGED_FILES" | grep -qE "\.(tsx|ts)$"; then
    if echo "$CHANGED_FILES" | grep -q "components/chatbot"; then
        TYPE="feat"
        SCOPE="chatbot"
        DESC="改善 chatbot 功能"
    elif echo "$CHANGED_FILES" | grep -q "components/ui"; then
        TYPE="feat"
        SCOPE="ui"
        DESC="更新 UI 組件"
    elif echo "$CHANGED_FILES" | grep -q "frontend"; then
        TYPE="feat"
        SCOPE="frontend"
        DESC="前端功能更新"
    fi
fi

if echo "$CHANGED_FILES" | grep -q "backend"; then
    TYPE="feat"
    SCOPE="backend"
    DESC="後端功能更新"
fi

if echo "$CHANGED_FILES" | grep -q "messages/zh-TW.json"; then
    TYPE="i18n"
    SCOPE=""
    DESC="更新翻譯文字"
fi

# 檢查是否有修復
if echo "$CHANGED_FILES" | grep -qE "(fix|bug|error)"; then
    TYPE="fix"
fi

# 生成 commit message
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    if [ -n "$SCOPE" ]; then
        COMMIT_MSG="${TYPE}(${SCOPE}): ${DESC}"
    else
        COMMIT_MSG="${TYPE}: ${DESC}"
    fi
    
    # 添加詳細說明
    echo -e "${YELLOW}自動生成的 commit message:${NC}"
    echo -e "${GREEN}${COMMIT_MSG}${NC}"
    echo ""
    read -p "使用此 message？(Y/n) 或輸入自訂 message: " USER_INPUT
    
    if [ "$USER_INPUT" != "Y" ] && [ "$USER_INPUT" != "y" ] && [ -n "$USER_INPUT" ]; then
        COMMIT_MSG="$USER_INPUT"
    fi
fi

# 添加所有變更
echo -e "${BLUE}=== 添加變更 ===${NC}"
git add .

# 提交
echo -e "${BLUE}=== 提交變更 ===${NC}"
echo -e "${GREEN}Commit message: ${COMMIT_MSG}${NC}"
git commit -m "$COMMIT_MSG"

# 獲取當前分支
CURRENT_BRANCH=$(git branch --show-current)

# 推送到遠端
echo -e "${BLUE}=== 推送到 GitHub ===${NC}"
if git push -u origin "$CURRENT_BRANCH" 2>/dev/null || git push origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}✓ 成功推送到 GitHub${NC}"
    echo -e "${GREEN}分支: ${CURRENT_BRANCH}${NC}"
    REMOTE_URL=$(git remote get-url origin)
    echo -e "${BLUE}遠端: ${REMOTE_URL}${NC}"
else
    echo -e "${RED}✗ 推送失敗${NC}"
    exit 1
fi

