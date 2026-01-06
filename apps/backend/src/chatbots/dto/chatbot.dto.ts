import { IsString, IsOptional, IsBoolean, IsInt, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChatbotDto {
  @ApiProperty({ description: 'Chatbot ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '用戶 ID' })
  @IsInt()
  userId: number;

  @ApiPropertyOptional({ description: '租戶 ID' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ description: 'Chatbot 名稱' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Chatbot 描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '狀態', default: 'draft' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '啟用狀態', default: 'active' })
  @IsString()
  @IsOptional()
  isActive?: string;

  @ApiPropertyOptional({ description: '主題配置' })
  @IsObject()
  @IsOptional()
  theme?: any;

  @ApiPropertyOptional({ description: '網域白名單' })
  @IsObject()
  @IsOptional()
  domainWhitelist?: any;
}

export class UpdateChatbotDto {
  @ApiPropertyOptional({ description: 'Chatbot 名稱' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Chatbot 描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '狀態' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '啟用狀態' })
  @IsString()
  @IsOptional()
  isActive?: string;

  @ApiPropertyOptional({ description: '主題配置' })
  @IsObject()
  @IsOptional()
  theme?: any;

  @ApiPropertyOptional({ description: '網域白名單' })
  @IsObject()
  @IsOptional()
  domainWhitelist?: any;
}

export class ChatbotQueryDto {
  @ApiPropertyOptional({ description: '用戶 ID' })
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({ description: '租戶 ID' })
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ description: '狀態' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '啟用狀態' })
  @IsString()
  @IsOptional()
  isActive?: string;
}


