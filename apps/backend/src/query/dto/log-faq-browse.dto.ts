import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 記錄 FAQ 直接瀏覽請求 DTO
 * 參考 AnswerGO 的 LogFaqBrowseRequest
 */
export class LogFaqBrowseDto {
  @ApiProperty({
    description: 'Chatbot ID',
    example: 'chatbot-123',
  })
  @IsNotEmpty({ message: 'chatbot_id 不能為空' })
  @IsString()
  chatbot_id: string;

  @ApiProperty({
    description: 'FAQ ID',
    example: 'clx0abcdef1234567890',
  })
  @IsNotEmpty({ message: 'faq_id 不能為空' })
  @IsString()
  faq_id: string;
}

/**
 * 記錄 FAQ 直接瀏覽回應 DTO
 */
export class LogFaqBrowseResponseDto {
  @ApiProperty({ description: '是否成功', example: true })
  success: boolean;

  @ApiProperty({ description: '訊息', example: '已記錄 FAQ 瀏覽' })
  message: string;

  @ApiProperty({ description: '搜尋日誌 ID', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', required: false })
  log_id?: string;
}

