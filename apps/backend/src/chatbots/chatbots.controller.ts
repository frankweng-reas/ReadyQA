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

@ApiTags('chatbots')
@Controller('chatbots')
export class ChatbotsController {
  constructor(private readonly chatbotsService: ChatbotsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 Chatbot' })
  @ApiResponse({ status: 201, description: '成功建立 Chatbot' })
  @ApiResponse({ status: 400, description: 'ID 已存在或資料驗證失敗' })
  async create(@Body() createDto: CreateChatbotDto) {
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
}


