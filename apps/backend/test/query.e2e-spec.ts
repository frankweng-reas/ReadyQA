import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ElasticsearchService } from '../src/elasticsearch/elasticsearch.service';

/**
 * Query API E2E 測試
 * 
 * 測試目標：
 * 1. POST /query/chat - 問答查詢
 * 2. POST /query/log-faq-action - Feedback 記錄
 * 3. POST /query/log-faq-browse - 直接瀏覽記錄
 */
describe('Query API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let elasticsearchService: ElasticsearchService;
  let testUserId: number;
  let testTenantId: string;
  let testChatbotId: string;
  let testFaqId: string;
  let testSessionToken: string;
  let testSessionId: string;
  let testLogId: string | null = null;

  // ========== 測試環境設置 ==========

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 啟用驗證管道（與正式環境一致）
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    elasticsearchService = app.get<ElasticsearchService>(ElasticsearchService);

    // 建立測試租戶和用戶
    const testTenant = await prisma.tenant.create({
      data: {
        id: 'test-tenant-query-' + Date.now(),
        name: 'Test Tenant for Query',
        planCode: 'free',
      },
    });
    testTenantId = testTenant.id;

    const testUser = await prisma.user.create({
      data: {
        email: 'test-query@example.com',
        username: 'test-query-user',
        supabaseUserId: 'test-supabase-query-' + Date.now(),
        tenantId: testTenantId,
      },
    });
    testUserId = testUser.id;

    // 建立測試 Chatbot
    const testChatbot = await prisma.chatbot.create({
      data: {
        id: 'test-chatbot-query-' + Date.now(),
        name: 'Test Chatbot for Query',
        userId: testUserId,
        tenantId: testTenantId,
        status: 'published',
        isActive: 'active',
        theme: {},
        domainWhitelist: {},
      },
    });
    testChatbotId = testChatbot.id;

    // 建立 ES Index（如果可用）
    if (elasticsearchService.isAvailable()) {
      try {
        await elasticsearchService.createFaqIndex(testChatbotId);
        console.log(`✅ 已建立 ES Index: faq_${testChatbotId}`);
      } catch (error) {
        console.warn(`⚠️ 建立 ES Index 失敗:`, error.message);
      }
    }

    // 建立測試 FAQ
    const testFaq = await prisma.faq.create({
      data: {
        id: 'test-faq-query-' + Date.now(),
        chatbotId: testChatbotId,
        question: '如何重置密碼？',
        answer: '請點擊「忘記密碼」按鈕，然後輸入您的電子郵件地址。',
        synonym: '',
        status: 'active',
      },
    });
    testFaqId = testFaq.id;

    // 同步 FAQ 到 ES（如果可用）
    if (elasticsearchService.isAvailable()) {
      try {
        await elasticsearchService.saveFaq(
          testChatbotId,
          testFaqId,
          testFaq.question,
          testFaq.answer,
          testFaq.synonym || '',
          testFaq.status,
          new Array(3072).fill(0.001), // Mock embedding
        );
        console.log(`✅ 已同步 FAQ 到 ES`);
      } catch (error) {
        console.warn(`⚠️ 同步 FAQ 到 ES 失敗:`, error.message);
      }
    }

    // 建立測試 Session
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    testSessionToken = 'test-session-token-' + Date.now();

    const testSession = await prisma.session.create({
      data: {
        token: testSessionToken,
        chatbotId: testChatbotId,
        tenantId: testTenantId,
        expiresAt: futureDate,
        maxQueries: 50,
        queryCount: 0,
      },
    });
    testSessionId = testSession.id;

    console.log(`✅ 測試環境已啟動`);
    console.log(`   Chatbot ID: ${testChatbotId}`);
    console.log(`   FAQ ID: ${testFaqId}`);
    console.log(`   Session Token: ${testSessionToken}`);
  });

  afterAll(async () => {
    // 清理測試資料
    if (testLogId) {
      await prisma.queryLogDetail.deleteMany({
        where: { logId: testLogId },
      });
      await prisma.queryLog.delete({
        where: { id: testLogId as string },
      });
    }

    await prisma.session.deleteMany({
      where: { chatbotId: testChatbotId },
    });

    await prisma.faq.deleteMany({
      where: { chatbotId: testChatbotId },
    });

    // 清理 ES Index
    if (elasticsearchService.isAvailable() && testChatbotId) {
      try {
        await elasticsearchService.deleteFaqIndex(testChatbotId);
        console.log(`🗑️ 已清理 ES Index`);
      } catch (error) {
        console.warn(`⚠️ 清理 ES Index 失敗:`, error.message);
      }
    }

    await prisma.chatbot.deleteMany({
      where: { id: testChatbotId },
    });

    await prisma.user.deleteMany({
      where: { id: testUserId },
    });

    await prisma.tenant.deleteMany({
      where: { id: testTenantId },
    });

    await app.close();
    console.log('✅ 測試環境已關閉');
  });

  // ========== POST /query/chat 測試 ==========

  describe('POST /query/chat', () => {
    it('✅ 應該成功查詢（有 Session Token）', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .set('Authorization', `Bearer ${testSessionToken}`)
        .send({
          query: '如何重置密碼？',
          chatbot_id: testChatbotId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('qa_blocks');
      expect(response.body).toHaveProperty('log_id');
      expect(response.body.log_id).toBeDefined();

      // 儲存 log_id 以便後續測試
      testLogId = response.body.log_id;

      // 驗證 QueryLog 已建立
      if (testLogId) {
        const queryLog = await prisma.queryLog.findUnique({
          where: { id: testLogId },
        });
        expect(queryLog).toBeDefined();
        expect(queryLog?.sessionId).toBe(testSessionId);
        expect(queryLog?.chatbotId).toBe(testChatbotId);
      }

      // 驗證 Session queryCount 已增加
      const session = await prisma.session.findUnique({
        where: { id: testSessionId },
      });
      expect(session?.queryCount).toBeGreaterThan(0);
    });

    it('✅ 應該成功查詢（無 Session Token，不記錄日誌）', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .send({
          query: '如何重置密碼？',
          chatbot_id: testChatbotId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('qa_blocks');
      expect(response.body.log_id).toBeUndefined();
    });

    it('❌ 應該拒絕過期的 Token', async () => {
      // 建立過期的 Session
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const expiredToken = 'expired-token-' + Date.now();

      await prisma.session.create({
        data: {
          token: expiredToken,
          chatbotId: testChatbotId,
          tenantId: testTenantId,
          expiresAt: pastDate,
          maxQueries: 50,
          queryCount: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          query: '如何重置密碼？',
          chatbot_id: testChatbotId,
        })
        .expect(401);

      expect(response.body.message).toContain('TOKEN_EXPIRED');

      // 清理
      await prisma.session.deleteMany({
        where: { token: expiredToken },
      });
    });

    it('❌ 應該拒絕無效的 Token', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .set('Authorization', 'Bearer invalid-token-123')
        .send({
          query: '如何重置密碼？',
          chatbot_id: testChatbotId,
        })
        .expect(401);

      expect(response.body.message).toContain('無效的 session token');
    });

    it('❌ 應該拒絕不存在的 Chatbot', async () => {
      // 不帶 Session Token，因為 Session Token 驗證會先檢查 chatbot_id 匹配
      // 注意：可能會因為配額檢查失敗而返回 400，或因為 Chatbot 不存在返回 404
      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .send({
          query: '如何重置密碼？',
          chatbot_id: 'non-existent-chatbot',
        });

      // 可能是 404 (Chatbot not found) 或 400 (配額檢查失敗)
      expect([400, 404]).toContain(response.status);
      if (response.status === 404) {
        expect(response.body.message).toContain('Chatbot not found');
      }
    });

    it('❌ 應該拒絕未啟用的 Chatbot', async () => {
      // 建立未啟用的 Chatbot 和對應的 Session
      const inactiveChatbot = await prisma.chatbot.create({
        data: {
          id: 'inactive-chatbot-' + Date.now(),
          name: 'Inactive Chatbot',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'inactive',
          theme: {},
          domainWhitelist: {},
        },
      });

      // 建立對應的 Session Token
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const inactiveSessionToken = 'inactive-session-token-' + Date.now();
      await prisma.session.create({
        data: {
          token: inactiveSessionToken,
          chatbotId: inactiveChatbot.id,
          tenantId: testTenantId,
          expiresAt: futureDate,
          maxQueries: 50,
          queryCount: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .set('Authorization', `Bearer ${inactiveSessionToken}`)
        .send({
          query: '如何重置密碼？',
          chatbot_id: inactiveChatbot.id,
        })
        .expect(400);

      expect(response.body.message).toContain('Chatbot 已暫停使用');

      // 清理
      await prisma.session.deleteMany({
        where: { chatbotId: inactiveChatbot.id },
      });
      await prisma.chatbot.deleteMany({
        where: { id: inactiveChatbot.id },
      });
    });

    it('✅ 應該允許 Preview mode 使用停用的 Chatbot', async () => {
      // 建立未啟用的 Chatbot 和對應的 Session
      const inactiveChatbot = await prisma.chatbot.create({
        data: {
          id: 'inactive-chatbot-preview-' + Date.now(),
          name: 'Inactive Chatbot for Preview',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'inactive',
          theme: {},
          domainWhitelist: {},
        },
      });

      // 建立對應的 Session Token
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const previewSessionToken = 'preview-session-token-' + Date.now();
      await prisma.session.create({
        data: {
          token: previewSessionToken,
          chatbotId: inactiveChatbot.id,
          tenantId: testTenantId,
          expiresAt: futureDate,
          maxQueries: 50,
          queryCount: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/query/chat')
        .set('Authorization', `Bearer ${previewSessionToken}`)
        .send({
          query: '如何重置密碼？',
          chatbot_id: inactiveChatbot.id,
          mode: 'preview',
        })
        .expect(200);

      expect(response.body).toHaveProperty('qa_blocks');

      // 清理
      await prisma.session.deleteMany({
        where: { chatbotId: inactiveChatbot.id },
      });
      await prisma.chatbot.deleteMany({
        where: { id: inactiveChatbot.id },
      });
    });
  });

  // ========== POST /query/log-faq-action 測試 ==========

  describe('POST /query/log-faq-action', () => {
    beforeEach(async () => {
      // 確保有 testLogId（如果沒有，建立一個）
      if (!testLogId) {
        const logId = 'test-log-' + Date.now();
        const log = await prisma.queryLog.create({
          data: {
            id: logId,
            session: { connect: { id: testSessionId } },
            chatbot: { connect: { id: testChatbotId } },
            query: '測試查詢',
            resultsCnt: 1,
            readCnt: 0,
          },
        });
        testLogId = log.id;
      }
    });

    it('✅ 應該成功記錄 viewed 動作', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-action')
        .send({
          log_id: testLogId,
          faq_id: testFaqId,
          action: 'viewed',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '已記錄操作');

      // 驗證 QueryLogDetail 已建立
      if (testLogId) {
        const detail = await prisma.queryLogDetail.findUnique({
          where: {
            logId_faqId: {
              logId: testLogId,
              faqId: testFaqId,
            },
          },
        });
        expect(detail).toBeDefined();
        expect(detail?.userAction).toBe('viewed');
      }

      // 驗證 QueryLog.readCnt 已更新
      if (testLogId) {
        const queryLog = await prisma.queryLog.findUnique({
          where: { id: testLogId },
        });
        expect(queryLog?.readCnt).toBeGreaterThan(0);
      }

      // 驗證 FAQ.hitCount 已增加
      const faq = await prisma.faq.findUnique({
        where: { id: testFaqId },
      });
      expect(faq?.hitCount).toBeGreaterThan(0);
    });

    it('✅ 應該成功記錄 like 動作', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-action')
        .send({
          log_id: testLogId,
          faq_id: testFaqId,
          action: 'like',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // 驗證 QueryLogDetail 已建立
      if (testLogId) {
        const detail = await prisma.queryLogDetail.findUnique({
          where: {
            logId_faqId: {
              logId: testLogId,
              faqId: testFaqId,
            },
          },
        });
        expect(detail).toBeDefined();
        expect(detail?.userAction).toBe('like');
      }
    });

    it('✅ 應該成功記錄 dislike 動作', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-action')
        .send({
          log_id: testLogId,
          faq_id: testFaqId,
          action: 'dislike',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // 驗證 QueryLogDetail 已更新
      if (testLogId) {
        const detail = await prisma.queryLogDetail.findUnique({
          where: {
            logId_faqId: {
              logId: testLogId,
              faqId: testFaqId,
            },
          },
        });
        expect(detail?.userAction).toBe('dislike');
      }
    });

    it('❌ 應該拒絕不存在的 log_id', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-action')
        .send({
          log_id: 'non-existent-log-id',
          faq_id: testFaqId,
          action: 'viewed',
        })
        .expect(404);

      expect(response.body.message).toContain('找不到 log_id');
    });

    it('❌ 應該拒絕不存在的 faq_id', async () => {
      if (!testLogId) {
        // 如果沒有 testLogId，先建立一個
        const logId = 'test-log-for-faq-test-' + Date.now();
        await prisma.queryLog.create({
          data: {
            id: logId,
            session: { connect: { id: testSessionId } },
            chatbot: { connect: { id: testChatbotId } },
            query: '測試查詢',
            resultsCnt: 1,
            readCnt: 0,
          },
        });
        testLogId = logId;
      }

      const response = await request(app.getHttpServer())
        .post('/query/log-faq-action')
        .send({
          log_id: testLogId,
          faq_id: 'non-existent-faq-id',
          action: 'viewed',
        })
        .expect(404);

      expect(response.body.message).toContain('找不到 faq_id');
    });
  });

  // ========== POST /query/log-faq-browse 測試 ==========

  describe('POST /query/log-faq-browse', () => {
    it('✅ 應該成功記錄直接瀏覽（有 Session Token）', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-browse')
        .set('Authorization', `Bearer ${testSessionToken}`)
        .send({
          chatbot_id: testChatbotId,
          faq_id: testFaqId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('log_id');
      expect(response.body.log_id).toBeDefined();

      const browseLogId = response.body.log_id;

      // 驗證 QueryLog 已建立
      const queryLog = await prisma.queryLog.findUnique({
        where: { id: browseLogId },
        include: {
          queryLogDetails: true,
        },
      });
      expect(queryLog).toBeDefined();
      expect(queryLog?.query).toBe('如何重置密碼？'); // 使用 FAQ 的 question
      expect(queryLog?.resultsCnt).toBe(1);
      expect(queryLog?.readCnt).toBe(1);

      // 驗證 QueryLogDetail 已建立
      expect(queryLog?.queryLogDetails).toHaveLength(1);
      expect(queryLog?.queryLogDetails[0].faqId).toBe(testFaqId);
      expect(queryLog?.queryLogDetails[0].userAction).toBe('viewed');

      // 驗證 FAQ.hitCount 已增加
      const faq = await prisma.faq.findUnique({
        where: { id: testFaqId },
      });
      expect(faq?.hitCount).toBeGreaterThan(0);

      // 驗證 Session queryCount 已增加
      const session = await prisma.session.findUnique({
        where: { id: testSessionId },
      });
      expect(session?.queryCount).toBeGreaterThan(0);

      // 清理
      await prisma.queryLogDetail.deleteMany({
        where: { logId: browseLogId },
      });
      await prisma.queryLog.deleteMany({
        where: { id: browseLogId },
      });
    });

    it('✅ 應該成功記錄直接瀏覽（無 Session Token）', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-browse')
        .send({
          chatbot_id: testChatbotId,
          faq_id: testFaqId,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.log_id).toBeUndefined(); // 沒有 session 時不記錄
    });

    it('❌ 應該拒絕不存在的 FAQ', async () => {
      const response = await request(app.getHttpServer())
        .post('/query/log-faq-browse')
        .set('Authorization', `Bearer ${testSessionToken}`)
        .send({
          chatbot_id: testChatbotId,
          faq_id: 'non-existent-faq-id',
        })
        .expect(404);

      expect(response.body.message).toContain('找不到 FAQ');
    });
  });
});
