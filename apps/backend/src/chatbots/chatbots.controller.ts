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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ChatbotsService } from './chatbots.service';
import { CreateChatbotDto, UpdateChatbotDto, ChatbotQueryDto } from './dto/chatbot.dto';
import { QuotaService } from '../common/quota.service';

/**
 * Chatbots Controller
 * 
 * 測試覆蓋率: 80.88%
 * 
 * TODO: 未測試的部分
 * - Line 208-256: uploadLogo() - Logo 上傳功能
 *   - 檔案驗證（格式、大小）
 *   - 檔名生成邏輯
 *   - 更新 theme.headerLogo
 */
@ApiTags('chatbots')
@Controller('chatbots')
export class ChatbotsController {
  constructor(
    private readonly chatbotsService: ChatbotsService,
    private readonly quotaService: QuotaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 Chatbot' })
  @ApiResponse({ status: 201, description: '成功建立 Chatbot' })
  @ApiResponse({ status: 400, description: 'ID 已存在或資料驗證失敗或超過配額' })
  async create(@Body() createDto: CreateChatbotDto) {
    // 檢查 Chatbot 數量配額
    const quotaCheck = await this.quotaService.checkCanCreateChatbot(createDto.userId);
    if (!quotaCheck.allowed) {
      throw new BadRequestException(quotaCheck.reason);
    }

    const chatbot = await this.chatbotsService.create(createDto);
    return {
      success: true,
      data: chatbot,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Chatbot 列表' })
  @ApiQuery({ name: 'userId', required: false, description: '用戶 ID' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租戶 ID' })
  @ApiQuery({ name: 'status', required: false, description: '狀態' })
  @ApiQuery({ name: 'isActive', required: false, description: '啟用狀態' })
  @ApiResponse({ status: 200, description: '成功取得列表' })
  async findAll(@Query() query: ChatbotQueryDto) {
    const chatbots = await this.chatbotsService.findAll(query);
    return {
      success: true,
      data: chatbots,
      total: chatbots.length,
    };
  }

  @Get(':id/public-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Chatbot 公開狀態（用於檢查是否啟用）' })
  @ApiResponse({ status: 200, description: '成功取得狀態' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async getPublicStatus(@Param('id') id: string) {
    const chatbot = await this.chatbotsService.findOne(id);
    
    return {
      success: true,
      data: {
        id: chatbot.id,
        name: chatbot.name,
        isActive: chatbot.isActive,
      },
    };
  }

  @Get(':id/public-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Chatbot 公開配置（用於嵌入頁面）' })
  @ApiResponse({ status: 200, description: '成功取得配置' })
  @ApiResponse({ status: 403, description: '網域白名單驗證失敗' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async getPublicConfig(@Param('id') id: string, @Req() request: Request) {
    const chatbot = await this.chatbotsService.findOne(id);
    
    // 檢查網域白名單（如果啟用）
    const domainWhitelist = chatbot.domainWhitelist as any;
    if (domainWhitelist?.enabled) {
      const referer = request.headers.referer || request.headers.origin;
      const allowedDomains = domainWhitelist.domains || [];
      
      // 如果是 localhost 或開發環境，跳過驗證
      const isLocalhost = referer && (
        referer.includes('localhost') || 
        referer.includes('127.0.0.1')
      );
      
      if (!isLocalhost && !this.isDomainAllowed(referer, allowedDomains)) {
        throw new ForbiddenException({
          message: '此 chatbot 只能通過授權網站嵌入使用。如需使用，請聯繫管理員將您的網域加入白名單。',
          error: '未授權的網域',
        });
      }
    }
    
    return {
      success: true,
      data: {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        theme: chatbot.theme,
        status: chatbot.status,
        isActive: chatbot.isActive,
      },
    };
  }

  /**
   * 檢查網域是否在白名單中
   */
  private isDomainAllowed(referer: string | undefined, whitelist: string[]): boolean {
    if (!referer) {
      // 沒有 Referer = 直接訪問，不允許
      return false;
    }

    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname;

      for (const allowedDomain of whitelist) {
        // 支援完整網域匹配
        if (allowedDomain === refererHost) {
          return true;
        }

        // 支援子網域匹配（*.subdomain.com）
        if (allowedDomain.startsWith('*.')) {
          const domainPattern = allowedDomain.slice(2); // 移除 '*.' 前綴
          if (refererHost === domainPattern || refererHost.endsWith('.' + domainPattern)) {
            return true;
          }
        }
      }

      return false;
    } catch {
      // URL 解析失敗，不允許
      return false;
    }
  }

  @Get(':id/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Chatbot 統計資料' })
  @ApiResponse({ status: 200, description: '成功取得統計' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async getStats(@Param('id') id: string) {
    const stats = await this.chatbotsService.getStats(id);
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id/overview-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Chatbot 總覽統計資料（用於分析頁面）' })
  @ApiQuery({ name: 'days', required: false, description: '統計天數（預設 30 天）' })
  @ApiResponse({ status: 200, description: '成功取得總覽統計' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async getOverviewStats(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const stats = await this.chatbotsService.getOverviewStats(id, daysNum);
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id/zero-result-queries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得零結果查詢詳細清單' })
  @ApiQuery({ name: 'days', required: false, description: '統計天數（預設 30 天）' })
  @ApiQuery({ name: 'limit', required: false, description: '返回數量（預設 20）' })
  @ApiResponse({ status: 200, description: '成功取得零結果查詢清單' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async getZeroResultQueries(
    @Param('id') id: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const data = await this.chatbotsService.getZeroResultQueries(id, daysNum, limitNum);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 Chatbot' })
  @ApiResponse({ status: 200, description: '成功取得 Chatbot' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async findOne(@Param('id') id: string) {
    const chatbot = await this.chatbotsService.findOne(id);
    return {
      success: true,
      data: chatbot,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 Chatbot' })
  @ApiResponse({ status: 200, description: '成功更新 Chatbot' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateChatbotDto) {
    const chatbot = await this.chatbotsService.update(id, updateDto);
    return {
      success: true,
      data: chatbot,
    };
  }

  @Patch(':id/touch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Touch Chatbot - 更新 updatedAt 時間戳' })
  @ApiResponse({ status: 200, description: '成功更新時間戳' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async touch(@Param('id') id: string) {
    const chatbot = await this.chatbotsService.touch(id);
    return {
      success: true,
      data: chatbot,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 Chatbot' })
  @ApiResponse({ status: 200, description: '成功刪除 Chatbot' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  async remove(@Param('id') id: string) {
    await this.chatbotsService.remove(id);
    return {
      success: true,
      message: 'Chatbot deleted successfully',
    };
  }

  @Post(':id/upload-logo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '上傳 Chatbot Logo' })
  @ApiResponse({ status: 200, description: 'Logo 上傳成功' })
  @ApiResponse({ status: 400, description: '檔案格式或大小不符' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chatbot-logos',
        filename: (req, file, cb) => {
          // 生成唯一檔名: chatbot-{id}-{timestamp}{ext}
          const chatbotId = req.params.id;
          const timestamp = Date.now();
          const ext = extname(file.originalname);
          cb(null, `chatbot-${chatbotId}-${timestamp}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // 只允許圖片檔案
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('請上傳檔案');
    }

    const logoPath = await this.chatbotsService.updateLogo(id, file.filename);

    return {
      success: true,
      data: {
        logoPath,
        filename: file.filename,
      },
      message: 'Logo 上傳成功',
    };
  }

  @Post(':id/upload-homeimage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '上傳 Chatbot 首頁背景圖' })
  @ApiResponse({ status: 200, description: '首頁背景圖上傳成功' })
  @ApiResponse({ status: 400, description: '檔案格式或大小不符' })
  @ApiResponse({ status: 404, description: 'Chatbot 不存在' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/chatbot-logos',
        filename: (req, file, cb) => {
          // 生成唯一檔名: chatbot-{id}-home-{timestamp}{ext}
          const chatbotId = req.params.id;
          const timestamp = Date.now();
          const ext = extname(file.originalname);
          cb(null, `chatbot-${chatbotId}-home-${timestamp}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // 只允許圖片檔案
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadHomeImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('請上傳檔案');
    }

    const imagePath = await this.chatbotsService.updateHomeImage(id, file.filename);

    return {
      success: true,
      data: {
        imagePath,
        filename: file.filename,
      },
      message: '首頁背景圖上傳成功',
    };
  }
}


