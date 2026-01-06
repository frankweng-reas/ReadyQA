import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueryLogsService } from './query-logs.service';
import {
  CreateQueryLogDto,
  CreateQueryLogDetailDto,
  QueryLogQueryDto,
} from './dto/query-log.dto';

@ApiTags('query-logs')
@Controller('query-logs')
export class QueryLogsController {
  constructor(private readonly queryLogsService: QueryLogsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 Query Log' })
  async create(@Body() createDto: CreateQueryLogDto) {
    const log = await this.queryLogsService.create(createDto);
    return {
      success: true,
      data: log,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Query Log 列表' })
  async findAll(@Query() query: QueryLogQueryDto) {
    const { logs, total } = await this.queryLogsService.findAll(query);
    return {
      success: true,
      data: logs,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得查詢統計' })
  async getStats(
    @Query('chatbotId') chatbotId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.queryLogsService.getStats(
      chatbotId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 Query Log' })
  async findOne(@Param('id') id: string) {
    const log = await this.queryLogsService.findOne(id);
    return {
      success: true,
      data: log,
    };
  }

  @Post('details')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立 Query Log Detail' })
  async createDetail(@Body() createDto: CreateQueryLogDetailDto) {
    const detail = await this.queryLogsService.createDetail(createDto);
    return {
      success: true,
      data: detail,
    };
  }

  @Get(':id/details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Query Log 的所有 Details' })
  async getDetails(@Param('id') id: string) {
    const details = await this.queryLogsService.getDetailsByLog(id);
    return {
      success: true,
      data: details,
      total: details.length,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 Query Log' })
  async remove(@Param('id') id: string) {
    await this.queryLogsService.remove(id);
    return {
      success: true,
      message: 'Query log deleted successfully',
    };
  }
}

