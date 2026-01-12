import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, UpdateSessionDto, SessionQueryDto } from './dto/session.dto';
import { InitSessionDto, InitSessionResponseDto } from './dto/init-session.dto';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * 初始化 Session（公開 API）
   * 初始化 Session
   * 
   * POST /sessions/init
   * 
   * Body:
   * {
   *   "chatbot_id": "chatbot-123"
   * }
   * 
   * Response:
   * {
   *   "token": "abc123...",
   *   "expires_at": "2025-12-31T23:59:59.000Z",
   *   "max_queries": 50
   * }
   */
  @Post('init')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 次/60秒
  @ApiOperation({ summary: '初始化 Session Token（公開 API）' })
  @ApiResponse({
    status: 200,
    description: '初始化成功',
    type: InitSessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Chatbot 不存在',
  })
  async initSession(@Body() dto: InitSessionDto) {
    const result = await this.sessionsService.initSession(dto.chatbot_id);
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 Session' })
  async create(@Body() createDto: CreateSessionDto) {
    const session = await this.sessionsService.create(createDto);
    return {
      success: true,
      data: session,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Session 列表' })
  async findAll(@Query() query: SessionQueryDto) {
    const { sessions, total } = await this.sessionsService.findAll(query);
    return {
      success: true,
      data: sessions,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Get('token/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '透過 token 取得 Session' })
  async findByToken(@Param('token') token: string) {
    const session = await this.sessionsService.findByToken(token);
    return {
      success: true,
      data: session,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 Session' })
  async findOne(@Param('id') id: string) {
    const session = await this.sessionsService.findOne(id);
    return {
      success: true,
      data: session,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 Session' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateSessionDto) {
    const session = await this.sessionsService.update(id, updateDto);
    return {
      success: true,
      data: session,
    };
  }

  @Post(':id/extend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '延長 Session 有效期' })
  async extend(@Param('id') id: string, @Body('days') days?: number) {
    const session = await this.sessionsService.extendExpiry(id, days || 30);
    return {
      success: true,
      data: session,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 Session' })
  async remove(@Param('id') id: string) {
    await this.sessionsService.remove(id);
    return {
      success: true,
      message: 'Session deleted successfully',
    };
  }
}

