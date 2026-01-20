import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import {
  GenerateCardsDto,
  GenerateCardFromTitleDto,
  FetchWebContentDto,
} from './dto/generate-cards.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /api/ai/generate-cards
   * 生成多張 FAQ 卡片
   */
  @Post('generate-cards')
  @HttpCode(HttpStatus.OK)
  async generateCards(@Body() dto: GenerateCardsDto) {
    return await this.aiService.generateCards(
      dto.chatbot_id,
      dto.content,
      dto.card_count,
    );
  }

  /**
   * POST /api/ai/generate-card-from-title
   * 根據標題生成答案
   */
  @Post('generate-card-from-title')
  @HttpCode(HttpStatus.OK)
  async generateCardFromTitle(@Body() dto: GenerateCardFromTitleDto) {
    return await this.aiService.generateCardFromTitle(
      dto.chatbot_id,
      dto.title,
      dto.content,
    );
  }

  /**
   * POST /api/ai/fetch-web-content
   * 從 URL 抓取網頁內容
   */
  @Post('fetch-web-content')
  @HttpCode(HttpStatus.OK)
  async fetchWebContent(@Body() dto: FetchWebContentDto) {
    return await this.aiService.fetchWebContent(dto.url);
  }
}
