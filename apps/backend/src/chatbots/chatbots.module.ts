import { Module } from '@nestjs/common';
import { ChatbotsController } from './chatbots.controller';
import { ChatbotsService } from './chatbots.service';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [ElasticsearchModule],
  controllers: [ChatbotsController],
  providers: [ChatbotsService],
  exports: [ChatbotsService],
})
export class ChatbotsModule {}


