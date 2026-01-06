import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlansModule } from './plans/plans.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { ChatbotsModule } from './chatbots/chatbots.module';
import { FaqsModule } from './faqs/faqs.module';
import { TopicsModule } from './topics/topics.module';
import { SessionsModule } from './sessions/sessions.module';
import { QueryLogsModule } from './query-logs/query-logs.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { AudioModule } from './audio/audio.module';
import { QueryModule } from './query/query.module';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '.env'],
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),
    // Database
    PrismaModule,
    // Authentication
    AuthModule,
    // Elasticsearch
    ElasticsearchModule,
    // Feature modules
    PlansModule,
    UsersModule,
    TenantsModule,
    ChatbotsModule,
    FaqsModule,
    TopicsModule,
    SessionsModule,
    QueryLogsModule,
    AudioModule,
    QueryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

