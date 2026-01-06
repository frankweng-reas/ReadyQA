import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Prisma disconnected from database');
  }

  /**
   * 清理資料庫（僅用於測試）
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const tables = [
      'query_log_details',
      'query_logs',
      'model_costs',
      'sessions',
      'faqs',
      'topics',
      'chatbots',
      'users',
      'tenants',
      'plans',
    ];

    for (const table of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }

    console.log('🗑️  Database cleaned');
  }
}

