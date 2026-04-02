#!/usr/bin/env node
/**
 * 一次性 FAQ → Elasticsearch 全量同步腳本
 * 在 backend 容器內執行：node /app/sync-es-once.js
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const { Client: EsClient } = require('@elastic/elasticsearch');
const axios = require('axios');

// ─── 設定 ─────────────────────────────────────────────────────────────────────
const ES_HOST = process.env.ELASTICSEARCH_HOST || 'http://elasticsearch:9200';
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMENSIONS || '3072', 10);

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

// ─── 確保 ES index 存在 ───────────────────────────────────────────────────────
async function ensureIndex(es, chatbotId) {
  const index = `faq_${chatbotId}`;
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({
      index,
      body: {
        mappings: {
          properties: {
            faq_id:       { type: 'keyword' },
            chatbot_id:   { type: 'keyword' },
            question:     { type: 'text', index: false },
            answer:       { type: 'text', index: false },
            synonym:      { type: 'text', index: false },
            status:       { type: 'keyword' },
            dense_vector: { type: 'dense_vector', dims: EMBEDDING_DIMS, index: true, similarity: 'cosine' },
            created_at:   { type: 'date' },
          },
        },
      },
    });
    console.log(`  📁 建立新 index: ${index}`);
  }
  return index;
}

// ─── 主程式 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FAQ → Elasticsearch 全量同步 ===');
  console.log(`ES: ${ES_HOST} | Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMS}dims)\n`);

  const prisma = new PrismaClient();
  const es = new EsClient({ node: ES_HOST });

  const health = await es.cluster.health();
  console.log(`ES 集群狀態: ${health.status}\n`);

  const faqs = await prisma.faq.findMany({
    select: { id: true, chatbotId: true, question: true, answer: true, synonym: true, status: true },
    orderBy: { chatbotId: 'asc' },
  });
  console.log(`PostgreSQL 共 ${faqs.length} 筆 FAQ\n`);

  let success = 0, failed = 0, skipped = 0;
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

      await es.index({
        index,
        id: faq.id,
        body: {
          faq_id:       faq.id,
          chatbot_id:   faq.chatbotId,
          question:     faq.question,
          answer:       faq.answer,
          synonym:      faq.synonym || '',
          status:       faq.status || 'active',
          dense_vector: vector,
          created_at:   new Date().toISOString(),
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
    errors.forEach(e => console.log(`  ${e.id}: ${e.error}`));
  }
  console.log('─────────────────────────────────────────');

  const { count } = await es.count({ index: 'faq_*' });
  console.log(`\nES 目前 faq_* 總文件數: ${count}`);
}

main().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
