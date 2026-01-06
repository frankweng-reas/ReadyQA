import { Module } from '@nestjs/common';
import { QueryLogsController } from './query-logs.controller';
import { QueryLogsService } from './query-logs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [QueryLogsController],
  providers: [QueryLogsService],
  exports: [QueryLogsService],
})
export class QueryLogsModule {}

