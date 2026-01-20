import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { QueryModule } from '../query/query.module';
import { ModelConfigService } from '../common/model-config.service';

@Module({
  imports: [QueryModule],
  controllers: [AiController],
  providers: [AiService, ModelConfigService],
  exports: [AiService],
})
export class AiModule {}
