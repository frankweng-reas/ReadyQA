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
import { CreateFaqDto, UpdateFaqDto, FaqQueryDto, BulkUploadFaqDto } from './dto/faq.dto';

@ApiTags('faqs')
@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 FAQ' })
  async create(@Body() createDto: CreateFaqDto) {
    try {
      console.log('[FaqsController] Creating FAQ:', JSON.stringify(createDto, null, 2));
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

  @Post('upload-image')
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

  @Post('bulk-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量上傳 FAQ' })
  @ApiResponse({ status: 200, description: '批量上傳成功' })
  @ApiResponse({ status: 400, description: '請求參數錯誤' })
  async bulkUpload(@Body() dto: BulkUploadFaqDto) {
    const result = await this.faqsService.bulkUpload(dto);
    return {
      success: result.success,
      ...result,
    };
  }
}


