#!/usr/bin/env node
/**
 * 一次性 FAQ → Elasticsearch 全量同步腳本
 * 在 backend 容器內執行：node /app/sync-es-once.js
 *
 * 必須與 apps/backend ElasticsearchService.saveFaq 行為一致：
 * - synonym 欄位存「question + synonym」經繁轉簡與停用詞處理後的文字（供 BM25 + IK）
 * - 新建 index 的 mapping/settings 與後端 createFaqIndex 一致（含 IK analyzer）
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const { Client: EsClient } = require('@elastic/elasticsearch');
const axios = require('axios');

let Converter;
try {
  Converter = require('opencc-js').Converter;
} catch (e) {
  console.error('缺少 opencc-js，請在 backend 容器內執行（/app 需有 node_modules）');
  process.exit(1);
}

// ─── 設定 ─────────────────────────────────────────────────────────────────────
const ES_HOST = process.env.ELASTICSEARCH_HOST || 'http://elasticsearch:9200';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMENSIONS || '3072', 10);

const toSimplified = Converter({ from: 'tw', to: 'cn' });
const STOP_WORDS = ['嗎', '呢', '吧', '啊', '呀', '了', '可以'];

function extractKeywords(text) {
  let cleaned = text;
  for (const w of STOP_WORDS) {
    cleaned = cleaned.replace(new RegExp(w, 'g'), ' ');
  }
  const simplified = toSimplified(cleaned);
  return simplified.split(/\s+/).filter(Boolean).join(' ');
}

function getIndexBody() {
  return {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        analyzer: {
          ik_max_word_analyzer: { type: 'ik_smart' },
          ik_smart_analyzer: { type: 'ik_smart' },
        },
      },
    },
    mappings: {
      properties: {
        faq_id: { type: 'keyword' },
        chatbot_id: { type: 'keyword' },
        question: { type: 'text', index: false },
        answer: { type: 'text', index: false },
        synonym: {
          type: 'text',
          analyzer: 'ik_max_word_analyzer',
          search_analyzer: 'ik_smart_analyzer',
        },
        dense_vector: {
          type: 'dense_vector',
          dims: EMBEDDING_DIMS,
          index: true,
          similarity: 'cosine',
        },
        created_at: { type: 'date' },
        updated_at: { type: 'date' },
        active_from: { type: 'date' },
        active_until: { type: 'date' },
        status: { type: 'keyword' },
      },
    },
  };
}

// ─── Embedding ────────────────────────────────────────────────────────────────
async function generateEmbedding(text) {
  try {
    const res = await axios.post(
      `${OPENAI_URL}/embeddings`,
      { model: EMBEDDING_MODEL, input: text },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    );
    return res.data.data[0].embedding;
  } catch (e) {
    console.warn(`  ⚠️  Embedding API 失敗，使用 fallback: ${e.message}`);
    return new Array(EMBEDDING_DIMS).fill(0.001);
  }
}

// ─── 確保 ES index 存在（與後端 mapping 一致）──────────────────────────────────
async function ensureIndex(es, chatbotId) {
  const index = `faq_${chatbotId}`;
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({ index, body: getIndexBody() });
    console.log(`  📁 建立新 index: ${index}`);
  }
  return index;
}

// ─── 主程式 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FAQ → Elasticsearch 全量同步（與後端 saveFaq 對齊）===');
  console.log(`ES: ${ES_HOST} | Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMS}dims)\n`);

  const prisma = new PrismaClient();
  const es = new EsClient({ node: ES_HOST });

  const health = await es.cluster.health();
  console.log(`ES 集群狀態: ${health.status}\n`);

  const chatbotFilter = process.env.SYNC_CHATBOT_ID;
  const faqs = await prisma.faq.findMany({
    where: chatbotFilter ? { chatbotId: chatbotFilter } : {},
    select: { id: true, chatbotId: true, question: true, answer: true, synonym: true, status: true },
    orderBy: { chatbotId: 'asc' },
  });
  console.log(
    chatbotFilter
      ? `PostgreSQL（chatbotId=${chatbotFilter}）共 ${faqs.length} 筆 FAQ\n`
      : `PostgreSQL 共 ${faqs.length} 筆 FAQ\n`,
  );

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < faqs.length; i++) {
    const faq = faqs[i];
    const progress = `[${i + 1}/${faqs.length}]`;

    if (!faq.question?.trim()) {
      console.log(`${progress} ⏭  略過（空問題）: ${faq.id}`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`${progress} ⚙  ${faq.id.substring(0, 25)}... `);
      const vector = await generateEmbedding(faq.question);
      const index = await ensureIndex(es, faq.chatbotId);

      const synonymCombined = `${faq.question} ${faq.synonym || ''}`.trim();
      const synonymForEs = extractKeywords(synonymCombined);

      const now = new Date().toISOString();
      await es.index({
        index,
        id: faq.id,
        body: {
          faq_id: faq.id,
          chatbot_id: faq.chatbotId,
          question: faq.question,
          answer: faq.answer,
          synonym: synonymForEs,
          status: faq.status || 'active',
          dense_vector: vector,
          created_at: now,
          updated_at: now,
        },
      });

      success++;
      console.log('✅');
    } catch (err) {
      failed++;
      errors.push({ id: faq.id, error: err.message });
      console.log(`❌ ${err.message}`);
    }
  }

  await es.indices.refresh({ index: 'faq_*' });
  await prisma.$disconnect();

  console.log('\n─── 結果 ───────────────────────────────');
  console.log(`總計: ${faqs.length} | ✅ 成功: ${success} | ❌ 失敗: ${failed} | ⏭  略過: ${skipped}`);
  if (errors.length) {
    console.log('\n失敗清單:');
    errors.forEach((e) => console.log(`  ${e.id}: ${e.error}`));
  }
  console.log('─────────────────────────────────────────');

  const { count } = await es.count({ index: 'faq_*' });
  console.log(`\nES 目前 faq_* 總文件數: ${count}`);
}

main().catch((err) => {
  console.error('執行失敗:', err);
  process.exit(1);
});
