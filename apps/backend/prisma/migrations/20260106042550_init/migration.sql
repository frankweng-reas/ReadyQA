-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planCode" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxChatbots" INTEGER,
    "maxFaqsPerBot" INTEGER,
    "maxQueriesPerMo" INTEGER,
    "enableAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "enableApi" BOOLEAN NOT NULL DEFAULT false,
    "enableExport" BOOLEAN NOT NULL DEFAULT false,
    "priceUsdMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceTwdMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyDefault" TEXT NOT NULL DEFAULT 'TWD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "chatbots" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL DEFAULT 1,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isActive" TEXT NOT NULL DEFAULT 'active',
    "theme" JSONB,
    "domainWhitelist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "topicId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "synonym" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "layout" TEXT NOT NULL DEFAULT 'text',
    "images" TEXT,
    "descStatus" TEXT NOT NULL DEFAULT 'pending',
    "activeFrom" TIMESTAMP(3),
    "activeUntil" TIMESTAMP(3),
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "queryCount" INTEGER NOT NULL DEFAULT 0,
    "maxQueries" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_logs" (
    "id" TEXT NOT NULL,
    "sessionId" UUID NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultsCnt" INTEGER NOT NULL DEFAULT 0,
    "readCnt" INTEGER NOT NULL DEFAULT 0,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_log_details" (
    "logId" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "userAction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_log_details_pkey" PRIMARY KEY ("logId","faqId")
);

-- CreateTable
CREATE TABLE "model_costs" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT,
    "chatbotId" TEXT,
    "sessionId" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiEndpoint" TEXT,
    "responseTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hybrid_search_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bm25Weight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "knnWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "topK" INTEGER NOT NULL DEFAULT 5,
    "scoreThreshold" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "rankConstant" INTEGER NOT NULL DEFAULT 60,
    "simThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hybrid_search_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenants_planCode_idx" ON "tenants"("planCode");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "chatbots_userId_idx" ON "chatbots"("userId");

-- CreateIndex
CREATE INDEX "chatbots_tenantId_idx" ON "chatbots"("tenantId");

-- CreateIndex
CREATE INDEX "chatbots_isActive_idx" ON "chatbots"("isActive");

-- CreateIndex
CREATE INDEX "faqs_chatbotId_idx" ON "faqs"("chatbotId");

-- CreateIndex
CREATE INDEX "faqs_status_idx" ON "faqs"("status");

-- CreateIndex
CREATE INDEX "faqs_topicId_idx" ON "faqs"("topicId");

-- CreateIndex
CREATE INDEX "faqs_descStatus_createdAt_idx" ON "faqs"("descStatus", "createdAt");

-- CreateIndex
CREATE INDEX "topics_chatbotId_idx" ON "topics"("chatbotId");

-- CreateIndex
CREATE INDEX "topics_parentId_idx" ON "topics"("parentId");

-- CreateIndex
CREATE INDEX "topics_chatbotId_parentId_sortOrder_idx" ON "topics"("chatbotId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "topics_chatbotId_name_key" ON "topics"("chatbotId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_chatbotId_idx" ON "sessions"("chatbotId");

-- CreateIndex
CREATE INDEX "sessions_tenantId_idx" ON "sessions"("tenantId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "query_logs_chatbotId_idx" ON "query_logs"("chatbotId");

-- CreateIndex
CREATE INDEX "query_logs_sessionId_idx" ON "query_logs"("sessionId");

-- CreateIndex
CREATE INDEX "query_logs_createdAt_idx" ON "query_logs"("createdAt");

-- CreateIndex
CREATE INDEX "query_logs_chatbotId_createdAt_idx" ON "query_logs"("chatbotId", "createdAt");

-- CreateIndex
CREATE INDEX "query_logs_resultsCnt_idx" ON "query_logs"("resultsCnt");

-- CreateIndex
CREATE INDEX "query_logs_ignored_idx" ON "query_logs"("ignored");

-- CreateIndex
CREATE INDEX "query_log_details_logId_idx" ON "query_log_details"("logId");

-- CreateIndex
CREATE INDEX "query_log_details_faqId_idx" ON "query_log_details"("faqId");

-- CreateIndex
CREATE INDEX "query_log_details_userAction_idx" ON "query_log_details"("userAction");

-- CreateIndex
CREATE INDEX "query_log_details_faqId_userAction_idx" ON "query_log_details"("faqId", "userAction");

-- CreateIndex
CREATE INDEX "model_costs_tenantId_idx" ON "model_costs"("tenantId");

-- CreateIndex
CREATE INDEX "model_costs_chatbotId_idx" ON "model_costs"("chatbotId");

-- CreateIndex
CREATE INDEX "model_costs_sessionId_idx" ON "model_costs"("sessionId");

-- CreateIndex
CREATE INDEX "model_costs_provider_idx" ON "model_costs"("provider");

-- CreateIndex
CREATE INDEX "model_costs_model_idx" ON "model_costs"("model");

-- CreateIndex
CREATE INDEX "model_costs_createdAt_idx" ON "model_costs"("createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_logs" ADD CONSTRAINT "query_logs_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_log_details" ADD CONSTRAINT "query_log_details_logId_fkey" FOREIGN KEY ("logId") REFERENCES "query_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_log_details" ADD CONSTRAINT "query_log_details_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
