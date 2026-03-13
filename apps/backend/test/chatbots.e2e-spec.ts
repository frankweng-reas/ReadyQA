import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ElasticsearchService } from '../src/elasticsearch/elasticsearch.service';

/**
 * Chatbot 管理 E2E 測試
 * 
 * 測試目標：
 * 1. POST /chatbots - 建立 Chatbot
 * 2. GET /chatbots - 取得列表
 * 3. GET /chatbots/:id - 取得單一 Chatbot
 * 4. GET /chatbots/:id/public-status - 取得公開狀態
 * 5. GET /chatbots/:id/public-config - 取得公開配置
 * 6. PATCH /chatbots/:id - 更新 Chatbot
 * 7. DELETE /chatbots/:id - 刪除 Chatbot
 * 8. GET /chatbots/:id/stats - 取得統計資料
 * 
 * TODO: 尚未實作的測試
 * - POST /chatbots/:id/upload-logo - Logo 上傳
 *   - 成功上傳圖片（jpg, png, gif, webp）
 *   - 拒絕非圖片檔案
 *   - 拒絕超過 5MB 的檔案
 *   - 更新 theme.headerLogo 路徑
 *   - 檔名格式驗證 (chatbot-{id}-{timestamp}.ext)
 * 
 * TODO: 進階測試場景
 * - Elasticsearch 失敗恢復
 *   - ES 索引建立失敗時會拋錯，不建立 Chatbot（已實作）
 *   - ES 索引刪除失敗時的處理
 * - TenantId 自動取得
 *   - 建立時未提供 tenantId，從 user 取得
 *   - user 沒有 tenantId 時的處理
 * - 併發測試
 *   - 同時建立多個 Chatbot
 *   - 同時更新同一個 Chatbot
 * - 邊界條件測試
 *   - 超長名稱 (>255 字元)
 *   - 特殊字元處理
 *   - null/undefined 處理
 * - 效能測試
 *   - 列表查詢大量資料時的效能
 *   - 統計資料查詢效能
 * 
 * 測試覆蓋率：
 * - Controller: 80.88% (目標: 90%+)
 * - Service: 80% (目標: 90%+)
 * - 整體: 80.82%
 */
describe('Chatbots (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let elasticsearchService: ElasticsearchService;
  let testUserId: number;
  let testTenantId: string;
  let createdChatbotId: string | null = null;

  // ========== 測試環境設置 ==========
  
  /**
   * 在所有測試之前執行一次
   * 啟動測試應用
   */
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // 啟用驗證管道（與正式環境一致）
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true, // ← 重要！轉換 query string 為正確型別
      forbidNonWhitelisted: true,
    }));
    
    await app.init();

    // 取得 PrismaService 實例
    prisma = app.get<PrismaService>(PrismaService);

    // 取得 ElasticsearchService 實例
    elasticsearchService = app.get<ElasticsearchService>(ElasticsearchService);

    // 建立測試用戶
    const testTenant = await prisma.tenant.create({
      data: {
        id: 'test-tenant-' + Date.now(),
        name: 'Test Tenant',
        planCode: 'free',
      },
    });
    testTenantId = testTenant.id;

    const testUser = await prisma.user.create({
      data: {
        email: 'test-chatbot@example.com',
        username: 'test-chatbot-user',
        supabaseUserId: 'test-supabase-id-' + Date.now(),
        tenantId: testTenantId,
      },
    });
    testUserId = testUser.id;

    console.log(`✅ 測試環境已啟動，測試用戶 ID: ${testUserId}`);
  });

  /**
   * 在所有測試之後執行一次
   * 清理測試資料並關閉應用
   */
  afterAll(async () => {
    // 清理測試資料
    await prisma.chatbot.deleteMany({
      where: { userId: testUserId },
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

  /**
   * 在每個測試之後執行
   * 清理該測試建立的 Chatbot 和 ES Index
   */
  afterEach(async () => {
    if (createdChatbotId) {
      // 清理 ES Index
      if (elasticsearchService.isAvailable()) {
        try {
          await elasticsearchService.deleteFaqIndex(createdChatbotId);
          console.log(`🗑️ 已清理 ES Index: faq_${createdChatbotId}`);
        } catch (error) {
          console.warn(`⚠️ 清理 ES Index 失敗:`, error.message);
        }
      }

      // 清理資料庫
      await prisma.chatbot.deleteMany({
        where: { id: createdChatbotId },
      });
      createdChatbotId = null;
    }
  });

  // ========== 測試案例 ==========

  describe('POST /chatbots', () => {
    it('✅ 應該成功建立 Chatbot', async () => {
      if (!elasticsearchService.isAvailable()) {
        console.log('⏭️ Elasticsearch 未連接，跳過此測試');
        return;
      }

      const createDto = {
        id: `test-chatbot-${Date.now()}`,
        name: '測試 Chatbot',
        description: '這是測試用的 Chatbot',
        userId: testUserId,
      };

      const response = await request(app.getHttpServer())
        .post('/chatbots')
        .send(createDto)
        .expect(201);

      // 驗證回應格式
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', createDto.id);
      expect(response.body.data).toHaveProperty('name', createDto.name);
      expect(response.body.data).toHaveProperty('description', createDto.description);
      expect(response.body.data).toHaveProperty('isActive', 'active'); // 預設值
      expect(response.body.data).toHaveProperty('theme'); // 應該有預設主題

      // 儲存 ID 以便清理
      createdChatbotId = response.body.data.id;

      console.log(`✅ 成功建立 Chatbot: ${createdChatbotId}`);
    });

    it('✅ 應該同時建立 Elasticsearch Index', async () => {
      // 跳過如果 ES 未連接
      if (!elasticsearchService.isAvailable()) {
        console.log('⏭️ Elasticsearch 未連接，跳過此測試');
        return;
      }

      const createDto = {
        id: `test-chatbot-${Date.now()}`,
        name: '測試 ES Index',
        description: '測試 Elasticsearch Index 建立',
        userId: testUserId,
      };

      // 1. 建立 Chatbot
      const response = await request(app.getHttpServer())
        .post('/chatbots')
        .send(createDto)
        .expect(201);

      createdChatbotId = response.body.data.id;
      const indexName = `faq_${createdChatbotId}`;

      // 2. 等待一下讓 ES Index 建立完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 3. 驗證 ES Index 是否存在
      const client = elasticsearchService['client'];
      expect(client).not.toBeNull();

      const indexExists = await client!.indices.exists({ index: indexName });
      expect(indexExists).toBe(true);

      console.log(`✅ ES Index 已建立: ${indexName}`);

      // 4. 驗證 Index 設定（可選）
      const indexInfo = await client!.indices.get({ index: indexName });
      expect(indexInfo[indexName]).toBeDefined();
      expect(indexInfo[indexName].mappings).toBeDefined();

      console.log('✅ ES Index 設定正確');
    });

    it('✅ 應該自動設置預設值', async () => {
      if (!elasticsearchService.isAvailable()) {
        console.log('⏭️ Elasticsearch 未連接，跳過此測試');
        return;
      }

      const createDto = {
        id: `test-chatbot-${Date.now()}`,
        name: '測試預設值',
        userId: testUserId,
        // 不提供 description, theme, domainWhitelist
      };

      const response = await request(app.getHttpServer())
        .post('/chatbots')
        .send(createDto)
        .expect(201);

      const chatbot = response.body.data;
      
      // 驗證預設值
      expect(chatbot.isActive).toBe('active');
      expect(chatbot.status).toBe('published');
      expect(chatbot.theme).toBeDefined(); // 應該有預設 theme
      expect(chatbot.domainWhitelist).toBeDefined(); // 應該有預設 domainWhitelist

      createdChatbotId = chatbot.id;
      console.log('✅ 預設值設置正確');
    });

    it('❌ ES 不可用時建立 Chatbot 應回傳 400', async () => {
      if (elasticsearchService.isAvailable()) {
        console.log('⏭️ Elasticsearch 已連接，跳過此測試');
        return;
      }

      const createDto = {
        id: `test-chatbot-${Date.now()}`,
        name: '測試 ES 不可用',
        userId: testUserId,
      };

      const response = await request(app.getHttpServer())
        .post('/chatbots')
        .send(createDto)
        .expect(400);

      expect(response.body.message).toContain('搜尋服務未就緒');
      console.log('✅ ES 不可用時正確回傳 400');
    });

    it('❌ 應該拒絕重複的 ID', async () => {
      if (!elasticsearchService.isAvailable()) {
        console.log('⏭️ Elasticsearch 未連接，跳過此測試');
        return;
      }

      const chatbotId = `test-duplicate-${Date.now()}`;
      const createDto = {
        id: chatbotId,
        name: '測試重複 ID',
        userId: testUserId,
      };

      // 第一次建立（成功）
      await request(app.getHttpServer())
        .post('/chatbots')
        .send(createDto)
        .expect(201);

      createdChatbotId = chatbotId;

      // 第二次建立（失敗）
      const response = await request(app.getHttpServer())
        .post('/chatbots')
        .send(createDto)
        .expect(400);

      expect(response.body.message).toContain('already exists');
      console.log('✅ 正確拒絕重複 ID');
    });
  });

  describe('GET /chatbots', () => {
    it('✅ 應該取得 Chatbot 列表', async () => {
      // 先清理該用戶的所有 chatbot（避免之前測試的遺留資料）
      await prisma.chatbot.deleteMany({
        where: { userId: testUserId },
      });

      // 建立測試用 Chatbot（有完整的 tenantId）
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '列表測試 Chatbot',
          userId: testUserId,
          tenantId: testTenantId, // ← 確保有 tenantId
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      console.log(`[Test] 建立測試 Chatbot: id=${chatbot.id}, userId=${testUserId}, tenantId=${testTenantId}`);

      // 直接用 Prisma 測試查詢（排除 HTTP 問題）
      try {
        const directResult = await prisma.chatbot.findMany({
          where: { userId: testUserId },
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
            tenant: {
              select: { id: true, name: true },
            },
            _count: {
              select: { faqs: true, topics: true },
            },
          },
        });
        console.log(`[Test] Prisma 直接查詢成功，找到 ${directResult.length} 個 chatbot`);
        console.log(`[Test] 第一個 chatbot:`, {
          id: directResult[0]?.id,
          tenantId: directResult[0]?.tenantId,
          tenant: directResult[0]?.tenant,
        });
      } catch (prismaError) {
        console.error(`[Test] ❌ Prisma 直接查詢失敗:`, prismaError.message);
        throw prismaError;
      }

      // 測試 HTTP API
      const response = await request(app.getHttpServer())
        .get(`/chatbots?userId=${testUserId}`)
        .expect(200);

      // 驗證回應格式
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);

      // 驗證資料結構
      const firstChatbot = response.body.data[0];
      expect(firstChatbot).toHaveProperty('id', chatbot.id);
      expect(firstChatbot).toHaveProperty('name', chatbot.name);
      expect(firstChatbot).toHaveProperty('_count');

      console.log(`✅ 成功取得 ${response.body.data.length} 個 Chatbot`);
    });
  });

  describe('GET /chatbots/:id', () => {
    it('✅ 應該取得單一 Chatbot', async () => {
      // 先建立一個 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '單一查詢測試',
          description: '測試描述',
          userId: testUserId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}`)
        .expect(200);

      // 驗證回應
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', chatbot.id);
      expect(response.body.data).toHaveProperty('name', chatbot.name);
      expect(response.body.data).toHaveProperty('description', chatbot.description);

      console.log('✅ 成功取得單一 Chatbot');
    });

    it('❌ 應該回傳 404 當 Chatbot 不存在', async () => {
      const nonExistentId = 'non-existent-id-12345';

      const response = await request(app.getHttpServer())
        .get(`/chatbots/${nonExistentId}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
      console.log('✅ 正確處理不存在的 Chatbot');
    });
  });

  describe('GET /chatbots/:id/public-status', () => {
    it('✅ 應該取得 Chatbot 公開狀態', async () => {
      // 建立測試用 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '公開狀態測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-status`)
        .expect(200);

      // 驗證回應（只包含必要欄位）
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', chatbot.id);
      expect(response.body.data).toHaveProperty('name', chatbot.name);
      expect(response.body.data).toHaveProperty('isActive', 'active');
      
      // 不應該包含敏感資料
      expect(response.body.data).not.toHaveProperty('userId');
      expect(response.body.data).not.toHaveProperty('tenantId');

      console.log('✅ 成功取得公開狀態');
    });

    it('✅ 應該正確回傳 inactive 狀態', async () => {
      // 建立停用的 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '停用測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'inactive', // 停用
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-status`)
        .expect(200);

      expect(response.body.data.isActive).toBe('inactive');
      console.log('✅ 正確回傳 inactive 狀態');
    });

    it('❌ 應該回傳 404 當 Chatbot 不存在', async () => {
      const nonExistentId = 'non-existent-id-12345';

      await request(app.getHttpServer())
        .get(`/chatbots/${nonExistentId}/public-status`)
        .expect(404);

      console.log('✅ Public status 正確處理不存在的 Chatbot');
    });
  });

  describe('GET /chatbots/:id/public-config', () => {
    it('✅ 應該取得 Chatbot 公開配置', async () => {
      // 建立測試用 Chatbot（沒有網域白名單）
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '公開配置測試',
          description: '測試描述',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: { primaryColor: '#000000' },
          domainWhitelist: { enabled: false, domains: [] }, // 未啟用白名單
        },
      });
      createdChatbotId = chatbot.id;

      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-config`)
        .expect(200);

      // 驗證回應包含必要配置
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', chatbot.id);
      expect(response.body.data).toHaveProperty('name', chatbot.name);
      expect(response.body.data).toHaveProperty('description', chatbot.description);
      expect(response.body.data).toHaveProperty('theme');
      expect(response.body.data).toHaveProperty('status', 'published');
      expect(response.body.data).toHaveProperty('isActive', 'active');
      
      // 不應該包含敏感資料
      expect(response.body.data).not.toHaveProperty('userId');
      expect(response.body.data).not.toHaveProperty('tenantId');

      console.log('✅ 成功取得公開配置');
    });

    it('✅ 應該允許 localhost 訪問（即使啟用白名單）', async () => {
      // 建立啟用白名單的 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '白名單測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {
            enabled: true,
            domains: ['example.com'], // localhost 不在白名單
          },
        },
      });
      createdChatbotId = chatbot.id;

      // 從 localhost 訪問應該成功（開發環境豁免）
      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-config`)
        .set('Referer', 'http://localhost:3000')
        .expect(200);

      expect(response.body.success).toBe(true);
      console.log('✅ localhost 訪問白名單豁免正常');
    });

    it('❌ 應該拒絕未授權網域（啟用白名單時）', async () => {
      // 建立啟用白名單的 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '白名單拒絕測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {
            enabled: true,
            domains: ['allowed.com'], // 只允許 allowed.com
          },
        },
      });
      createdChatbotId = chatbot.id;

      // 從未授權網域訪問應該被拒絕
      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-config`)
        .set('Referer', 'https://evil.com')
        .expect(403);

      expect(response.body.message).toContain('授權');
      console.log('✅ 正確拒絕未授權網域');
    });

    it('✅ 應該允許白名單中的網域', async () => {
      // 建立啟用白名單的 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '白名單允許測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {
            enabled: true,
            domains: ['allowed.com', 'trusted.com'],
          },
        },
      });
      createdChatbotId = chatbot.id;

      // 從白名單網域訪問應該成功
      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-config`)
        .set('Referer', 'https://allowed.com/page')
        .expect(200);

      expect(response.body.success).toBe(true);
      console.log('✅ 正確允許白名單網域');
    });

    it('✅ 應該支援萬用字元網域 (*.example.com)', async () => {
      // 建立使用萬用字元的白名單
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '萬用字元測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {
            enabled: true,
            domains: ['*.example.com'], // 允許所有 example.com 子網域
          },
        },
      });
      createdChatbotId = chatbot.id;

      // 子網域應該被允許
      const response1 = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-config`)
        .set('Referer', 'https://sub.example.com')
        .expect(200);
      expect(response1.body.success).toBe(true);

      // 根網域也應該被允許
      const response2 = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/public-config`)
        .set('Referer', 'https://example.com')
        .expect(200);
      expect(response2.body.success).toBe(true);

      console.log('✅ 萬用字元網域驗證正常');
    });

    it('❌ 應該回傳 404 當 Chatbot 不存在', async () => {
      const nonExistentId = 'non-existent-id-12345';

      await request(app.getHttpServer())
        .get(`/chatbots/${nonExistentId}/public-config`)
        .expect(404);

      console.log('✅ Public config 正確處理不存在的 Chatbot');
    });
  });

  describe('PATCH /chatbots/:id', () => {
    it('✅ 應該成功更新 Chatbot 基本資料', async () => {
      // 先建立一個 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '更新前的名稱',
          description: '更新前的描述',
          userId: testUserId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      const updateDto = {
        name: '更新後的名稱',
        description: '更新後的描述',
      };

      const response = await request(app.getHttpServer())
        .patch(`/chatbots/${chatbot.id}`)
        .send(updateDto)
        .expect(200);

      // 驗證回應
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('name', updateDto.name);
      expect(response.body.data).toHaveProperty('description', updateDto.description);

      // 驗證資料庫
      const updated = await prisma.chatbot.findUnique({
        where: { id: chatbot.id },
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe(updateDto.name);
      expect(updated!.description).toBe(updateDto.description);

      console.log('✅ 成功更新 Chatbot 基本資料');
    });

    it('✅ 應該成功更新 isActive 狀態', async () => {
      // 先建立一個 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '狀態測試',
          userId: testUserId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      // 更新為 inactive
      const response = await request(app.getHttpServer())
        .patch(`/chatbots/${chatbot.id}`)
        .send({ isActive: 'inactive' })
        .expect(200);

      expect(response.body.data.isActive).toBe('inactive');

      // 驗證資料庫
      const updated = await prisma.chatbot.findUnique({
        where: { id: chatbot.id },
      });
      expect(updated).not.toBeNull();
      expect(updated!.isActive).toBe('inactive');

      console.log('✅ 成功更新 isActive 狀態');
    });

    it('✅ 應該支援部分更新', async () => {
      // 先建立一個 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '部分更新測試',
          description: '原始描述',
          userId: testUserId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      // 只更新名稱
      await request(app.getHttpServer())
        .patch(`/chatbots/${chatbot.id}`)
        .send({ name: '新名稱' })
        .expect(200);

      // 驗證其他欄位沒變
      const updated = await prisma.chatbot.findUnique({
        where: { id: chatbot.id },
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('新名稱');
      expect(updated!.description).toBe('原始描述'); // 沒變

      console.log('✅ 部分更新正常運作');
    });
  });

  describe('DELETE /chatbots/:id', () => {
    it('✅ 應該成功刪除 Chatbot', async () => {
      // 先建立一個 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '刪除測試',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });

      // 刪除
      const response = await request(app.getHttpServer())
        .delete(`/chatbots/${chatbot.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // 驗證資料庫中已刪除
      const deleted = await prisma.chatbot.findUnique({
        where: { id: chatbot.id },
      });
      expect(deleted).toBeNull();

      console.log('✅ 成功刪除 Chatbot');
    });

    it('✅ 應該同時刪除 Elasticsearch Index', async () => {
      // 跳過如果 ES 未連接
      if (!elasticsearchService.isAvailable()) {
        console.log('⏭️ Elasticsearch 未連接，跳過此測試');
        return;
      }

      // 1. 建立 Chatbot 和 ES Index
      const chatbotId = `test-chatbot-${Date.now()}`;
      await prisma.chatbot.create({
        data: {
          id: chatbotId,
          name: '測試刪除 ES Index',
          userId: testUserId,
          tenantId: testTenantId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });

      // 建立 ES Index
      await elasticsearchService.createFaqIndex(chatbotId);
      const indexName = `faq_${chatbotId}`;

      // 確認 Index 存在
      const client = elasticsearchService['client'];
      let indexExists = await client!.indices.exists({ index: indexName });
      expect(indexExists).toBe(true);
      console.log(`✅ ES Index 已建立: ${indexName}`);

      // 2. 刪除 Chatbot
      await request(app.getHttpServer())
        .delete(`/chatbots/${chatbotId}`)
        .expect(200);

      // 3. 等待一下讓 ES Index 刪除完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 4. 驗證 ES Index 已刪除
      indexExists = await client!.indices.exists({ index: indexName });
      expect(indexExists).toBe(false);

      console.log(`✅ ES Index 已刪除: ${indexName}`);
    });

    it('❌ 應該回傳 404 當刪除不存在的 Chatbot', async () => {
      const nonExistentId = 'non-existent-id-12345';

      await request(app.getHttpServer())
        .delete(`/chatbots/${nonExistentId}`)
        .expect(404);

      console.log('✅ 正確處理刪除不存在的 Chatbot');
    });
  });

  // ========== 統計測試 ==========

  describe('GET /chatbots/:id/stats', () => {
    it('✅ 應該取得 Chatbot 統計資料', async () => {
      // 先建立一個 Chatbot
      const chatbot = await prisma.chatbot.create({
        data: {
          id: `test-chatbot-${Date.now()}`,
          name: '統計測試',
          userId: testUserId,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });
      createdChatbotId = chatbot.id;

      const response = await request(app.getHttpServer())
        .get(`/chatbots/${chatbot.id}/stats`)
        .expect(200);

      // 驗證回應結構
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('chatbot');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('faqCount');
      expect(response.body.data.stats).toHaveProperty('topicCount');
      expect(response.body.data.stats).toHaveProperty('sessionCount');
      expect(response.body.data.stats).toHaveProperty('queryLogCount');

      console.log('✅ 成功取得統計資料');
    });
  });
});
