import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 查詢請求 DTO
 */
export class ChatQueryDto {
  @ApiProperty({
    description: '用戶問題',
    example: '如何重置密碼？',
  })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({
    description: 'Chatbot ID',
    example: 'chatbot-123',
  })
  @IsString()
  @IsNotEmpty()
  chatbot_id: string;

  @ApiProperty({
    description: 'Session Token（從 Authorization header 獲取）',
    required: false,
  })
  @IsOptional()
  @IsString()
  session_token?: string;

  @ApiProperty({
    description: '模式：preview（預覽模式，跳過 isActive 檢查）/ production（生產模式，檢查 isActive）',
    example: 'production',
    required: false,
    default: 'production',
  })
  @IsOptional()
  @IsString()
  mode?: 'preview' | 'production';
}

/**
 * Q&A 區塊
 */
export class QABlockDto {
  @ApiProperty({
    description: 'FAQ ID',
    example: 'faq-123',
  })
  faq_id: string;

  @ApiProperty({
    description: '問題',
    example: '如何重置密碼？',
  })
  question: string;

  @ApiProperty({
    description: '答案',
    example: '請點擊「忘記密碼」按鈕...',
  })
  answer: string;

  @ApiProperty({
    description: '布局類型',
    example: 'text',
    required: false,
  })
  layout?: string;

  @ApiProperty({
    description: '圖片 URL 列表（JSON 格式）',
    required: false,
  })
  images?: string;
}

/**
 * 查詢回應 DTO
 */
export class ChatQueryResponseDto {
  @ApiProperty({
    description: '介紹文字',
    example: '以下是可能符合您需求的答案：',
    required: false,
  })
  intro?: string;

  @ApiProperty({
    description: 'Q&A 區塊列表',
    type: [QABlockDto],
  })
  qa_blocks: QABlockDto[];

  @ApiProperty({
    description: '搜尋日誌 ID（用於後續追蹤操作）',
    example: 'log-uuid-123',
    required: false,
  })
  log_id?: string;
}

