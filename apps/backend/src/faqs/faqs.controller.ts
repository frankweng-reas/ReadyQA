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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto, FaqQueryDto, BulkUploadFaqDto, BatchUpdateSortOrderDto } from './dto/faq.dto';
import { QuotaService } from '../common/quota.service';

/**
 * FAQ 管理 Controller
 * 
 * 測試覆蓋率: 69.38% (參考 /test/faqs.e2e-spec.ts)
 * 
 * ✅ 已測試的功能:
 * - POST /faqs - 建立 FAQ
 * - GET /faqs - 取得列表（含分頁）
 * - GET /faqs/:id - 取得單一 FAQ
 * - PATCH /faqs/:id - 更新 FAQ
 * - DELETE /faqs/:id - 刪除 FAQ
 * - POST /faqs/:id/hit - 記錄點擊
 * 
 * ❌ 未測試的功能（Line 89-103, 116-127, 135-142, 158-159）:
 * - PATCH /faqs/batch-sort - 批量更新排序
 * - POST /faqs/upload-image - 圖片上傳
 * - POST /faqs/bulk-upload - 批量上傳
 */
@ApiTags('faqs')
@Controller('faqs')
export class FaqsController {
  constructor(
    private readonly faqsService: FaqsService,
    private readonly quotaService: QuotaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 FAQ' })
  @ApiResponse({ status: 400, description: '資料驗證失敗或超過配額' })
  async create(@Body() createDto: CreateFaqDto) {
    try {
      console.log('[FaqsController] Creating FAQ:', JSON.stringify(createDto, null, 2));
      
      // 檢查 FAQ 數量配額
      const quotaCheck = await this.quotaService.checkCanCreateFaq(createDto.chatbotId);
      if (!quotaCheck.allowed) {
        throw new BadRequestException(quotaCheck.reason);
      }
      
      const faq = await this.faqsService.create(createDto);
      console.log('[FaqsController] FAQ created successfully:', faq.id);
      return {
        success: true,
        data: faq,
      };
    } catch (error) {
      console.error('[FaqsController] Create FAQ error:', error);
      throw error;
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 FAQ 列表' })
  async findAll(@Query() query: FaqQueryDto) {
    const { faqs, total } = await this.faqsService.findAll(query);
    return {
      success: true,
      data: faqs,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Patch('batch-sort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量更新 FAQ 排序' })
  @ApiResponse({ status: 200, description: '批量更新排序成功' })
  @ApiResponse({ status: 400, description: '請求參數錯誤' })
  async batchUpdateSortOrder(@Body() dto: BatchUpdateSortOrderDto) {
    console.log('[FaqsController] batchUpdateSortOrder 收到請求:', JSON.stringify(dto, null, 2));
    console.log('[FaqsController] dto.chatbotId:', dto.chatbotId);
    console.log('[FaqsController] dto.updates:', dto.updates);
    const result = await this.faqsService.batchUpdateSortOrder(dto.chatbotId, dto.updates);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 FAQ' })
  async findOne(@Param('id') id: string) {
    const faq = await this.faqsService.findOne(id);
    return {
      success: true,
      data: faq,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 FAQ' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateFaqDto) {
    const faq = await this.faqsService.update(id, updateDto);
    return {
      success: true,
      data: faq,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 FAQ' })
  async remove(@Param('id') id: string) {
    await this.faqsService.remove(id);
    return {
      success: true,
      message: 'FAQ deleted successfully',
    };
  }

  @Post(':id/hit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '記錄 FAQ 點擊' })
  async incrementHit(@Param('id') id: string) {
    const faq = await this.faqsService.incrementHitCount(id);
    return {
      success: true,
      data: faq,
    };
  }

  @Post('upload-image') // ❌ 未測試
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '上傳 FAQ 圖片' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: '圖片上傳成功' })
  @ApiResponse({ status: 400, description: '檔案格式或大小不符' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/faq-images',
        filename: (req, file, cb) => {
          // 生成唯一檔名: faq-{timestamp}-{random}{ext}
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 9);
          const ext = extname(file.originalname);
          cb(null, `faq-${timestamp}-${random}${ext}`);
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
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('請上傳檔案');
    }

    // 返回圖片 URL 路徑
    const imagePath = `/uploads/faq-images/${file.filename}`;

    return {
      success: true,
      data: {
        imageUrl: imagePath,
        filename: file.filename,
      },
      message: '圖片上傳成功',
    };
  }

  @Post('bulk-upload') // ❌ 未測試
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量上傳 FAQ' })
  @ApiResponse({ status: 200, description: '批量上傳成功' })
  @ApiResponse({ status: 400, description: '請求參數錯誤' })
  async bulkUpload(@Body() dto: BulkUploadFaqDto) {
    const result = await this.faqsService.bulkUpload(dto);
    return result;
  }
}


