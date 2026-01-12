import { Module } from '@nestjs/common';
import { ChatbotsController } from './chatbots.controller';
import { ChatbotsService } from './chatbots.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaService } from '../common/quota.service';

@Module({
  imports: [ElasticsearchModule, PrismaModule],
  controllers: [ChatbotsController],
  providers: [ChatbotsService, QuotaService],
  exports: [ChatbotsService],
})
export class ChatbotsModule {}


