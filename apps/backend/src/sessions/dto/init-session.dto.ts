import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 初始化 Session 請求 DTO
 * 參考 AnswerGO 的 SessionInitRequest
 */
export class InitSessionDto {
  @ApiProperty({
    description: 'Chatbot ID',
    example: 'chatbot-123',
  })
  @IsNotEmpty({ message: 'chatbot_id 不能為空' })
  @IsString()
  chatbot_id: string;
}

/**
 * 初始化 Session 回應 DTO
 * 參考 AnswerGO 的 SessionInitResponse
 */
export class InitSessionResponseDto {
  @ApiProperty({ description: 'Session Token', example: 'abc123...' })
  token: string;

  @ApiProperty({ description: '過期時間', example: '2025-12-31T23:59:59.000Z' })
  expires_at: string;

  @ApiProperty({ description: '最大查詢次數', example: 50 })
  max_queries: number;
}

