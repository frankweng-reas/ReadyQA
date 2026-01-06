#!/bin/bash

# QAPlus - 重建 Elasticsearch 索引腳本
# 用途：為所有現有 chatbot 建立 ES 索引

set -e

API_URL="${API_URL:-http://localhost:8000/api}"
ES_URL="${ES_URL:-http://localhost:9200}"

echo "🔍 正在獲取所有 chatbot..."
CHATBOTS=$(curl -s "$API_URL/chatbots" | python3 -c "import sys, json; data=json.load(sys.stdin); print(' '.join([c['id'] for c in data['data']]))")

if [ -z "$CHATBOTS" ]; then
  echo "❌ 沒有找到任何 chatbot"
  exit 1
fi

echo "📋 找到 chatbot: $CHATBOTS"
echo ""

for CHATBOT_ID in $CHATBOTS; do
  INDEX_NAME="faq_$CHATBOT_ID"
  
  # 檢查索引是否已存在
  if curl -s -o /dev/null -w "%{http_code}" "$ES_URL/$INDEX_NAME" | grep -q "200"; then
    echo "✅ 索引已存在: $INDEX_NAME"
    continue
  fi
  
  echo "🔨 正在建立索引: $INDEX_NAME"
  
  # 建立索引
  RESULT=$(curl -s -X PUT "$ES_URL/$INDEX_NAME" \
    -H 'Content-Type: application/json' \
    -d '{
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
          "analyzer": {
            "cjk_bigram": {
              "type": "custom",
              "tokenizer": "standard",
              "filter": ["cjk_bigram", "lowercase"]
            }
          },
          "filter": {
            "cjk_bigram": {
              "type": "cjk_bigram",
              "ignore_scripts": true
            }
          }
        }
      },
      "mappings": {
        "properties": {
          "faq_id": { "type": "keyword" },
          "chatbot_id": { "type": "keyword" },
          "question": { "type": "text", "index": false },
          "answer": { "type": "text", "index": false },
          "synonym": {
            "type": "text",
            "analyzer": "cjk_bigram",
            "fields": { "keyword": { "type": "keyword" } }
          },
          "dense_vector": {
            "type": "dense_vector",
            "dims": 3072,
            "index": true,
            "similarity": "cosine"
          },
          "created_at": { "type": "date" },
          "updated_at": { "type": "date" },
          "active_from": { "type": "date" },
          "active_until": { "type": "date" },
          "status": { "type": "keyword" }
        }
      }
    }')
  
  if echo "$RESULT" | grep -q "acknowledged.*true"; then
    echo "✅ 成功建立索引: $INDEX_NAME"
  else
    echo "❌ 建立索引失敗: $INDEX_NAME"
    echo "$RESULT"
  fi
  echo ""
done

echo ""
echo "📊 目前所有索引："
curl -s "$ES_URL/_cat/indices?v"

