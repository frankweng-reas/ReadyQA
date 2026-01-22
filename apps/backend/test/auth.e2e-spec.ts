import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Auth API E2E 測試
 * 
 * 測試目標：
 * 1. POST /auth/get-or-create-user - 獲取或創建用戶
 */
describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdUserId: number | null = null;
  let createdTenantId: string | null = null;

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

    console.log(`✅ 測試環境已啟動`);
  });

  afterAll(async () => {
    // 清理測試資料
    if (createdUserId) {
      await prisma.user.deleteMany({
        where: { id: createdUserId as number },
      });
    }

    if (createdTenantId) {
      await prisma.tenant.deleteMany({
        where: { id: createdTenantId },
      });
    }

    await app.close();
    console.log('✅ 測試環境已關閉');
  });

  // ========== POST /auth/get-or-create-user 測試 ==========

  describe('POST /auth/get-or-create-user', () => {
    it('✅ 應該成功創建新用戶（自動創建 Tenant）', async () => {
      const supabaseUserId = 'test-supabase-new-' + Date.now();
      const email = `test-new-${Date.now()}@example.com`;
      const name = 'New Test User';

      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          supabaseUserId,
          email,
          name,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '用戶建立成功');
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('created', true);

      createdUserId = response.body.userId;
      createdTenantId = String(createdUserId);

      // 驗證用戶已建立
      const user = await prisma.user.findUnique({
        where: { id: createdUserId as number },
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
      expect(user?.username).toBe(name);
      expect(user?.supabaseUserId).toBe(supabaseUserId);
      expect(user?.tenantId).toBe(createdTenantId);

      // 驗證 Tenant 已建立
      const tenant = await prisma.tenant.findUnique({
        where: { id: createdTenantId },
      });
      expect(tenant).toBeDefined();
      expect(tenant?.planCode).toBe('free');
      expect(tenant?.status).toBe('active');
    });

    it('✅ 應該成功創建新用戶（沒有提供 email 和 name）', async () => {
      const supabaseUserId = 'test-supabase-no-email-' + Date.now();

      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          supabaseUserId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('created', true);

      const userId = response.body.userId;

      // 驗證用戶已建立（使用預設值）
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user).toBeDefined();
      expect(user?.supabaseUserId).toBe(supabaseUserId);
      expect(user?.email).toContain('@supabase.local'); // 預設 email 格式
      expect(user?.username).toBe('Supabase User'); // 預設 username

      // 清理
      await prisma.user.deleteMany({
        where: { id: userId },
      });
      await prisma.tenant.deleteMany({
        where: { id: String(userId) },
      });
    });

    it('✅ 應該返回現有用戶（通過 supabaseUserId）', async () => {
      // 先建立一個用戶
      const supabaseUserId = 'test-supabase-existing-' + Date.now();
      const email = `test-existing-${Date.now()}@example.com`;
      const name = 'Existing User';

      const existingUser = await prisma.user.create({
        data: {
          email,
          username: name,
          supabaseUserId,
          isActive: true,
        },
      });

      const existingTenant = await prisma.tenant.create({
        data: {
          id: String(existingUser.id),
          name,
          planCode: 'free',
          status: 'active',
        },
      });

      await prisma.user.update({
        where: { id: existingUser.id },
        data: { tenantId: existingTenant.id },
      });

      // 測試 API
      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          supabaseUserId,
          email,
          name,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '用戶已存在');
      expect(response.body).toHaveProperty('userId', existingUser.id);
      expect(response.body).toHaveProperty('created', false);

      // 清理
      await prisma.user.deleteMany({
        where: { id: existingUser.id },
      });
      await prisma.tenant.deleteMany({
        where: { id: existingTenant.id },
      });
    });

    it('✅ 應該更新現有用戶的 supabaseUserId（email 存在但 supabaseUserId 為 null）', async () => {
      const email = `test-update-${Date.now()}@example.com`;
      const name = 'Update User';
      const supabaseUserId = 'test-supabase-update-' + Date.now();

      // 先建立一個沒有 supabaseUserId 的用戶
      const existingUser = await prisma.user.create({
        data: {
          email,
          username: name,
          supabaseUserId: null,
          isActive: true,
        },
      });

      const existingTenant = await prisma.tenant.create({
        data: {
          id: String(existingUser.id),
          name,
          planCode: 'free',
          status: 'active',
        },
      });

      await prisma.user.update({
        where: { id: existingUser.id },
        data: { tenantId: existingTenant.id },
      });

      // 測試 API
      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          supabaseUserId,
          email,
          name,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '已更新用戶的 Supabase ID');
      expect(response.body).toHaveProperty('userId', existingUser.id);
      expect(response.body).toHaveProperty('created', false);

      // 驗證 supabaseUserId 已更新
      const updatedUser = await prisma.user.findUnique({
        where: { id: existingUser.id },
      });
      expect(updatedUser?.supabaseUserId).toBe(supabaseUserId);

      // 清理
      await prisma.user.deleteMany({
        where: { id: existingUser.id },
      });
      await prisma.tenant.deleteMany({
        where: { id: existingTenant.id },
      });
    });

    it('✅ 應該智能合併（email 存在但 supabaseUserId 不同）', async () => {
      const email = `test-merge-${Date.now()}@example.com`;
      const name = 'Merge User';
      const oldSupabaseUserId = 'old-supabase-id-' + Date.now();
      const newSupabaseUserId = 'new-supabase-id-' + Date.now();

      // 先建立一個用戶（有舊的 supabaseUserId）
      const existingUser = await prisma.user.create({
        data: {
          email,
          username: name,
          supabaseUserId: oldSupabaseUserId,
          isActive: true,
        },
      });

      const existingTenant = await prisma.tenant.create({
        data: {
          id: String(existingUser.id),
          name,
          planCode: 'free',
          status: 'active',
        },
      });

      await prisma.user.update({
        where: { id: existingUser.id },
        data: { tenantId: existingTenant.id },
      });

      // 建立一些 chatbot（測試智能合併訊息）
      await prisma.chatbot.create({
        data: {
          id: 'test-chatbot-merge-' + Date.now(),
          name: 'Test Chatbot',
          userId: existingUser.id,
          tenantId: existingTenant.id,
          status: 'published',
          isActive: 'active',
          theme: {},
          domainWhitelist: {},
        },
      });

      // 測試 API（使用新的 supabaseUserId）
      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          supabaseUserId: newSupabaseUserId,
          email,
          name,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('已更新用戶的 Supabase ID');
      expect(response.body.message).toContain('已保留'); // 應該提到保留了 chatbot
      expect(response.body).toHaveProperty('userId', existingUser.id);
      expect(response.body).toHaveProperty('created', false);

      // 驗證 supabaseUserId 已更新
      const updatedUser = await prisma.user.findUnique({
        where: { id: existingUser.id },
      });
      expect(updatedUser?.supabaseUserId).toBe(newSupabaseUserId);

      // 清理
      await prisma.chatbot.deleteMany({
        where: { userId: existingUser.id },
      });
      await prisma.user.deleteMany({
        where: { id: existingUser.id },
      });
      await prisma.tenant.deleteMany({
        where: { id: existingTenant.id },
      });
    });

    it('❌ 應該拒絕缺少 supabaseUserId', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          email: 'test@example.com',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('❌ 應該拒絕無效的 email 格式', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/get-or-create-user')
        .send({
          supabaseUserId: 'test-supabase-' + Date.now(),
          email: 'invalid-email', // 無效的 email
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });
});
