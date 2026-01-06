import { Module } from '@nestjs/common';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [PrismaModule, ElasticsearchModule],
  controllers: [FaqsController],
  providers: [FaqsService],
  exports: [FaqsService],
})
export class FaqsModule {}


