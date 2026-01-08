import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ElasticsearchService } from '../src/elasticsearch/elasticsearch.service';

/**
 * FAQ 管理 E2E 測試
 * 
 * 測試目標：
 * 1. POST /faqs - 建立 FAQ
 * 2. GET /faqs - 取得列表
 * 3. GET /faqs/:id - 取得單一 FAQ
 * 4. PATCH /faqs/:id - 更新 FAQ
 * 5. DELETE /faqs/:id - 刪除 FAQ
 * 6. POST /faqs/:id/hit - 記錄點擊
 * 
 * TODO: 尚未實作的測試
 * - POST /faqs/upload-image - 圖片上傳
 * - POST /faqs/bulk-upload - 批量上傳
 * - Elasticsearch 同步測試
 *   - 建立 FAQ 時同步到 ES
 *   - 更新 FAQ 時同步到 ES
 *   - 刪除 FAQ 時從 ES 移除
 * - 查詢參數測試
 *   - 按 chatbotId 過濾
 *   - 按 topicId 過濾
 *   - 按 status 過濾
 *   - 按 search 搜尋
 *   - 分頁 (limit/offset)
 */
describe('FAQs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let elasticsearchService: ElasticsearchService;
  let testUserId: number;
  let testTenantId: string;
  let testChatbotId: string;
  let createdFaqId: string | null = null;

  // ========== 測試環境設置 ==========

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // 啟用驗證管道（與正式環境一致）
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    elasticsearchService = app.get<ElasticsearchService>(ElasticsearchService);

    // 建立測試用戶和租戶
    const testTenant = await prisma.tenant.create({
      data: {
        id: 'test-tenant-faq-' + Date.now(),
        name: 'Test Tenant for FAQ',
        planCode: 'free',
      },
    });
    testTenantId = testTenant.id;

    const testUser = await prisma.user.create({
      data: {
        email: 'test-faq@example.com',
        username: 'test-faq-user',
        supabaseUserId: 'test-supabase-faq-' + Date.now(),
        tenantId: testTenantId,
      },
    });
    testUserId = testUser.id;

    // 建立測試用 Chatbot
    const testChatbot = await prisma.chatbot.create({
      data: {
        id: 'test-chatbot-faq-' + Date.now(),
        name: 'Test Chatbot for FAQ',
        userId: testUserId,
        tenantId: testTenantId,
        status: 'published',
        isActive: 'active',
        theme: {},
        domainWhitelist: {},
      },
    });
    testChatbotId = testChatbot.id;

    // 建立 ES Index
    if (elasticsearchService.isAvailable()) {
      await elasticsearchService.createFaqIndex(testChatbotId);
    }

    console.log(`✅ 測試環境已啟動`);
    console.log(`   測試用戶 ID: ${testUserId}`);
    console.log(`   測試租戶 ID: ${testTenantId}`);
    console.log(`   測試 Chatbot ID: ${testChatbotId}`);
  });

  afterAll(async () => {
    // 清理測試資料
    await prisma.faq.deleteMany({
      where: { chatbotId: testChatbotId },
    });
    await prisma.chatbot.deleteMany({
      where: { id: testChatbotId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenantId },
    });

    // 刪除 ES Index
    if (elasticsearchService.isAvailable()) {
      await elasticsearchService.deleteFaqIndex(testChatbotId);
    }

    await app.close();
    console.log('✅ 測試環境已關閉');
  });

  afterEach(async () => {
    if (createdFaqId) {
      await prisma.faq.deleteMany({
        where: { id: createdFaqId },
      });
      createdFaqId = null;
    }
  });

  // ========== 測試案例 ==========

  describe('POST /faqs', () => {
    it('✅ 應該成功建立 FAQ', async () => {
      const createDto = {
        id: `test-faq-${Date.now()}`,
        chatbotId: testChatbotId,
        question: '測試問題',
        answer: '測試答案',
        synonym: '同義詞1 / 同義詞2',
        status: 'active',
      };

      const response = await request(app.getHttpServer())
        .post('/faqs')
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', createDto.id);
      expect(response.body.data).toHaveProperty('question', createDto.question);
      expect(response.body.data).toHaveProperty('answer', createDto.answer);
      expect(response.body.data).toHaveProperty('status', 'active');

      createdFaqId = response.body.data.id;
      console.log(`✅ 成功建立 FAQ: ${createdFaqId}`);
    });

    it('✅ 應該設置預設值', async () => {
      const createDto = {
        id: `test-faq-${Date.now()}`,
        chatbotId: testChatbotId,
        question: '預設值測試',
        answer: '測試答案',
        synonym: '',
        // 不提供 status, layout
      };

      const response = await request(app.getHttpServer())
        .post('/faqs')
        .send(createDto)
        .expect(201);

      expect(response.body.data.status).toBe('active'); // 預設 active
      expect(response.body.data.layout).toBe('text'); // 預設 text
      expect(response.body.data.hitCount).toBe(0); // 預設 0

      createdFaqId = response.body.data.id;
      console.log('✅ 預設值設置正確');
    });
  });

  describe('GET /faqs', () => {
    it('✅ 應該取得 FAQ 列表', async () => {
      // 先建立測試 FAQ
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '列表測試問題',
          answer: '列表測試答案',
          synonym: '',
          status: 'active',
        },
      });
      createdFaqId = faq.id;

      const response = await request(app.getHttpServer())
        .get(`/faqs?chatbotId=${testChatbotId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('total');

      console.log(`✅ 成功取得 ${response.body.data.length} 個 FAQ`);
    });

    it('✅ 應該支援分頁', async () => {
      const response = await request(app.getHttpServer())
        .get(`/faqs?chatbotId=${testChatbotId}&limit=10&offset=0`)
        .expect(200);

      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('offset', 0);

      console.log('✅ 分頁參數正常');
    });
  });

  describe('GET /faqs/:id', () => {
    it('✅ 應該取得單一 FAQ', async () => {
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '單一查詢測試',
          answer: '測試答案',
          synonym: '',
          status: 'active',
        },
      });
      createdFaqId = faq.id;

      const response = await request(app.getHttpServer())
        .get(`/faqs/${faq.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', faq.id);
      expect(response.body.data).toHaveProperty('question', faq.question);

      console.log('✅ 成功取得單一 FAQ');
    });

    it('❌ 應該回傳 404 當 FAQ 不存在', async () => {
      const nonExistentId = 'non-existent-faq-12345';

      await request(app.getHttpServer())
        .get(`/faqs/${nonExistentId}`)
        .expect(404);

      console.log('✅ 正確處理不存在的 FAQ');
    });
  });

  describe('PATCH /faqs/:id', () => {
    it('✅ 應該成功更新 FAQ', async () => {
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '更新前的問題',
          answer: '更新前的答案',
          synonym: '',
          status: 'active',
        },
      });
      createdFaqId = faq.id;

      const updateDto = {
        question: '更新後的問題',
        answer: '更新後的答案',
      };

      const response = await request(app.getHttpServer())
        .patch(`/faqs/${faq.id}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('question', updateDto.question);
      expect(response.body.data).toHaveProperty('answer', updateDto.answer);

      // 驗證資料庫
      const updated = await prisma.faq.findUnique({
        where: { id: faq.id },
      });
      expect(updated?.question).toBe(updateDto.question);

      console.log('✅ 成功更新 FAQ');
    });

    it('✅ 應該支援部分更新', async () => {
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '部分更新測試',
          answer: '原始答案',
          synonym: '',
          status: 'active',
        },
      });
      createdFaqId = faq.id;

      // 只更新 status
      await request(app.getHttpServer())
        .patch(`/faqs/${faq.id}`)
        .send({ status: 'inactive' })
        .expect(200);

      // 驗證其他欄位沒變
      const updated = await prisma.faq.findUnique({
        where: { id: faq.id },
      });
      expect(updated?.status).toBe('inactive');
      expect(updated?.answer).toBe('原始答案'); // 沒變

      console.log('✅ 部分更新正常運作');
    });
  });

  describe('DELETE /faqs/:id', () => {
    it('✅ 應該成功刪除 FAQ', async () => {
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '刪除測試',
          answer: '測試答案',
          synonym: '',
          status: 'active',
        },
      });

      await request(app.getHttpServer())
        .delete(`/faqs/${faq.id}`)
        .expect(200);

      // 驗證資料庫中已刪除
      const deleted = await prisma.faq.findUnique({
        where: { id: faq.id },
      });
      expect(deleted).toBeNull();

      console.log('✅ 成功刪除 FAQ');
    });

    it('❌ 應該回傳 404 當刪除不存在的 FAQ', async () => {
      const nonExistentId = 'non-existent-faq-12345';

      await request(app.getHttpServer())
        .delete(`/faqs/${nonExistentId}`)
        .expect(404);

      console.log('✅ 正確處理刪除不存在的 FAQ');
    });
  });

  describe('POST /faqs/:id/hit', () => {
    it('✅ 應該記錄 FAQ 點擊次數', async () => {
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '點擊測試',
          answer: '測試答案',
          synonym: '',
          status: 'active',
          hitCount: 0,
        },
      });
      createdFaqId = faq.id;

      const response = await request(app.getHttpServer())
        .post(`/faqs/${faq.id}/hit`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.hitCount).toBe(1);

      // 驗證資料庫
      const updated = await prisma.faq.findUnique({
        where: { id: faq.id },
      });
      expect(updated?.hitCount).toBe(1);

      console.log('✅ 成功記錄點擊');
    });

    it('✅ 應該累加點擊次數', async () => {
      const faq = await prisma.faq.create({
        data: {
          id: `test-faq-${Date.now()}`,
          chatbotId: testChatbotId,
          question: '累加測試',
          answer: '測試答案',
          synonym: '',
          status: 'active',
          hitCount: 5,
        },
      });
      createdFaqId = faq.id;

      await request(app.getHttpServer())
        .post(`/faqs/${faq.id}/hit`)
        .expect(200);

      const updated = await prisma.faq.findUnique({
        where: { id: faq.id },
      });
      expect(updated?.hitCount).toBe(6); // 5 + 1

      console.log('✅ 點擊次數正確累加');
    });
  });
});
