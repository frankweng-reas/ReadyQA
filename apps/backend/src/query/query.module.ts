import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';
import { LlmService } from './llm.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ModelConfigService } from '../common/model-config.service';
import { QuotaService } from '../common/quota.service';

/**
 * 查詢模組
 * 提供 Chatbot 問答查詢功能
 */
@Module({
  imports: [PrismaModule, ElasticsearchModule, SessionsModule],
  controllers: [QueryController],
  providers: [QueryService, LlmService, ModelConfigService, QuotaService],
  exports: [QueryService, LlmService],
})
export class QueryModule {}

