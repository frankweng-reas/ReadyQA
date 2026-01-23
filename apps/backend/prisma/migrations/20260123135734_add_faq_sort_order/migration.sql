-- AlterTable
ALTER TABLE "faqs" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "faqs_chatbotId_topicId_sortOrder_idx" ON "faqs"("chatbotId", "topicId", "sortOrder");

-- 為現有 FAQ 設定初始 sortOrder（按 chatbotId 和 topicId 分組，每個組內按 createdAt 排序）
WITH ranked_faqs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY "chatbotId", COALESCE("topicId", '') ORDER BY "createdAt" ASC) - 1 AS new_sort_order
  FROM "faqs"
)
UPDATE "faqs"
SET "sortOrder" = ranked_faqs.new_sort_order
FROM ranked_faqs
WHERE "faqs".id = ranked_faqs.id;
