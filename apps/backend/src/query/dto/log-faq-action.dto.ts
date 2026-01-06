import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

/**
 * 記錄 FAQ 操作請求 DTO
 */
export class LogFaqActionDto {
  @ApiProperty({
    description: '搜尋日誌 ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsNotEmpty({ message: 'log_id 不能為空' })
  @IsString()
  log_id: string;

  @ApiProperty({
    description: 'FAQ ID',
    example: 'clx0abcdef1234567890',
  })
  @IsNotEmpty({ message: 'faq_id 不能為空' })
  @IsString()
  faq_id: string;

  @ApiProperty({
    description: '操作類型',
    enum: ['viewed', 'not-viewed', 'like', 'dislike'],
    example: 'like',
  })
  @IsNotEmpty({ message: 'action 不能為空' })
  @IsIn(['viewed', 'not-viewed', 'like', 'dislike'], {
    message: 'action 必須是: viewed, not-viewed, like, dislike 之一',
  })
  action: 'viewed' | 'not-viewed' | 'like' | 'dislike';
}

/**
 * 記錄 FAQ 操作回應 DTO
 */
export class LogFaqActionResponseDto {
  @ApiProperty({ description: '是否成功', example: true })
  success: boolean;

  @ApiProperty({ description: '訊息', example: '已記錄操作' })
  message: string;
}

