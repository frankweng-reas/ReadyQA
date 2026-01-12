import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { QueryService } from './query.service';
import { SessionsService } from '../sessions/sessions.service';
import { QuotaService } from '../common/quota.service';
import { ChatQueryDto, ChatQueryResponseDto } from './dto/chat-query.dto';
import {
  LogFaqActionDto,
  LogFaqActionResponseDto,
} from './dto/log-faq-action.dto';
import {
  LogFaqBrowseDto,
  LogFaqBrowseResponseDto,
} from './dto/log-faq-browse.dto';

/**
 * 查詢控制器
 * 提供 Chatbot 問答查詢 API
 */
@ApiTags('query')
@Controller('query')
export class QueryController {
  private readonly logger = new Logger(QueryController.name);

  constructor(
    private readonly queryService: QueryService,
    private readonly sessionsService: SessionsService,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * 問答查詢
   * Chatbot 查詢端點
   * 
   * POST /query/chat
   * 
   * Header:
   *   Authorization: Bearer <session_token>
   * 
   * Body:
   * {
   *   "query": "如何重置密碼？",
   *   "chatbot_id": "chatbot-123"
   * }
   * 
   * Response:
   * {
   *   "intro": "以下是可能符合您需求的答案：",
   *   "qa_blocks": [
   *     {
   *       "faq_id": "faq-123",
   *       "question": "如何重置密碼？",
   *       "answer": "請點擊「忘記密碼」按鈕...",
   *       "layout": "text"
   *     }
   *   ],
   *   "log_id": "log-uuid-123"
   * }
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 次/分鐘
  @ApiOperation({ summary: '問答查詢（帶上下文的 AI 對話）' })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer token (session token)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '查詢成功',
    type: ChatQueryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '請求參數錯誤',
  })
  @ApiResponse({
    status: 401,
    description: '未授權（Session token 無效或過期）',
  })
  @ApiResponse({
    status: 503,
    description: 'LLM 服務暫時無法使用',
  })
  async chat(
    @Body() dto: ChatQueryDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<ChatQueryResponseDto> {
    this.logger.log(
      `[Query Chat] 收到查詢請求: "${dto.query}" (chatbot: ${dto.chatbot_id})`,
    );

    // ========== 步驟 1: 提取並驗證 Session Token ==========
    let sessionId: string | undefined = undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.replace('Bearer ', '').trim();
      
      if (sessionToken) {
        try {
          const sessionInfo = await this.sessionsService.verifyToken(
            sessionToken,
            dto.chatbot_id,
          );
          sessionId = sessionInfo.session_id;
          this.logger.log(
            `[Query Chat] ✅ Session 驗證成功: session_id=${sessionId}`,
          );
        } catch (error: any) {
          // 如果是 TOKEN_EXPIRED，返回特定錯誤
          if (error.message === 'TOKEN_EXPIRED') {
            this.logger.warn(`[Query Chat] ⚠️ Token 已過期`);
            throw new UnauthorizedException('TOKEN_EXPIRED');
          }
          
          this.logger.warn(
            `[Query Chat] ⚠️ Session 驗證失敗: ${error.message}`,
          );
          throw new UnauthorizedException('無效的 session token');
        }
      }
    } else {
      this.logger.warn(
        `[Query Chat] ⚠️ 未提供 session token，將不會記錄查詢日誌`,
      );
    }

    // ========== 步驟 2: 檢查查詢配額 (Quota) ==========
    try {
      await this.quotaService.ensureQueryQuota(dto.chatbot_id);
      this.logger.log(`[Query Chat] ✅ 配額檢查通過`);
    } catch (error: any) {
      this.logger.warn(`[Query Chat] ⚠️ 配額檢查失敗: ${error.message}`);
      throw error;
    }

    // ========== 步驟 3: 調用查詢服務 ==========
    try {
      const result = await this.queryService.chatWithContext(dto, sessionId);
      this.logger.log(
        `[Query Chat] ✅ 查詢成功，返回 ${result.qa_blocks.length} 個結果`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`[Query Chat] ❌ 查詢失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * 記錄 FAQ 操作（viewed / like / dislike）
   * 記錄 FAQ 操作端點
   * 
   * POST /query/log-faq-action
   * 
   * Body:
   * {
   *   "log_id": "log-uuid-123",
   *   "faq_id": "faq-123",
   *   "action": "like"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "已記錄操作"
   * }
   */
  @Post('log-faq-action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '記錄 FAQ 操作（viewed/like/dislike）' })
  @ApiResponse({
    status: 200,
    description: '記錄成功',
    type: LogFaqActionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '請求參數錯誤',
  })
  @ApiResponse({
    status: 404,
    description: '找不到對應的 log_id 或 faq_id',
  })
  async logFaqAction(
    @Body() dto: LogFaqActionDto,
  ): Promise<LogFaqActionResponseDto> {
    this.logger.log(
      `[Log FAQ Action] 📥 收到請求: log_id=${dto.log_id}, faq_id=${dto.faq_id}, action=${dto.action}`,
    );

    try {
      await this.queryService.logFaqAction(dto);
      return {
        success: true,
        message: '已記錄操作',
      };
    } catch (error: any) {
      this.logger.error(
        `[Log FAQ Action] ❌ 記錄失敗: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      } else if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('記錄操作失敗');
    }
  }

  /**
   * 記錄 FAQ 直接瀏覽
   * 記錄 FAQ 瀏覽端點
   * 
   * POST /query/log-faq-browse
   * 
   * Header:
   *   Authorization: Bearer <session_token> (可選)
   * 
   * Body:
   * {
   *   "chatbot_id": "chatbot-123",
   *   "faq_id": "faq-123"
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "已記錄 FAQ 瀏覽",
   *   "log_id": "log-uuid-123"
   * }
   */
  @Post('log-faq-browse')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 次/60秒
  @ApiOperation({ summary: '記錄 FAQ 直接瀏覽（非搜尋結果）' })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer token (session token)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '記錄成功',
    type: LogFaqBrowseResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: '找不到對應的 FAQ',
  })
  async logFaqBrowse(
    @Body() dto: LogFaqBrowseDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<LogFaqBrowseResponseDto> {
    this.logger.log(
      `[Log FAQ Browse] 📥 收到請求: chatbot_id=${dto.chatbot_id}, faq_id=${dto.faq_id}`,
    );

    // ========== 步驟 1: 提取並驗證 Session Token（可選）==========
    let sessionId: string | undefined = undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.replace('Bearer ', '').trim();

      if (sessionToken) {
        try {
          const sessionInfo = await this.sessionsService.verifyToken(
            sessionToken,
            dto.chatbot_id,
          );
          sessionId = sessionInfo.session_id;
          this.logger.log(
            `[Log FAQ Browse] ✅ Session 驗證成功: session_id=${sessionId}`,
          );
        } catch (error: any) {
          // Token 過期或無效時，允許繼續但跳過日誌記錄
          this.logger.warn(
            `[Log FAQ Browse] ⚠️ Session 驗證失敗，跳過日誌記錄: ${error.message}`,
          );
        }
      }
    }

    // ========== 步驟 2: 檢查查詢配額 (Quota) ==========
    // FAQ 瀏覽也需要檢查配額（參考 answergo）
    try {
      await this.quotaService.ensureQueryQuota(dto.chatbot_id);
      this.logger.log(`[Log FAQ Browse] ✅ 配額檢查通過`);
    } catch (error: any) {
      this.logger.warn(`[Log FAQ Browse] ⚠️ 配額檢查失敗: ${error.message}`);
      throw error;
    }

    // ========== 步驟 3: 記錄 FAQ 瀏覽 ==========
    try {
      const logId = await this.queryService.logFaqBrowse(dto, sessionId);
      return {
        success: true,
        message: '已記錄 FAQ 瀏覽',
        log_id: logId || undefined,
      };
    } catch (error: any) {
      this.logger.error(
        `[Log FAQ Browse] ❌ 記錄失敗: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('記錄 FAQ 瀏覽失敗');
    }
  }
}

