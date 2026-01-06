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
import { FaqsService } from './faqs.service';
import { CreateFaqDto, UpdateFaqDto, FaqQueryDto } from './dto/faq.dto';

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
}


