import { IsString, IsOptional, IsInt, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateQueryLogDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiProperty()
  @IsString()
  query: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  resultsCnt?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  readCnt?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  ignored?: boolean;
}

export class CreateQueryLogDetailDto {
  @ApiProperty()
  @IsString()
  logId: string;

  @ApiProperty()
  @IsString()
  faqId: string;

  @ApiProperty()
  @IsString()
  userAction: string;
}

export class QueryLogQueryDto {
  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  ignored?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  offset?: number = 0;

  @ApiPropertyOptional({ description: '僅 resultsCnt 為 0 的紀錄' })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  zeroOnly?: boolean;

  @ApiPropertyOptional({
    enum: ['createdAt', 'resultsCnt', 'readCnt', 'sessionId', 'query'],
    description: '排序欄位（預設 createdAt）',
  })
  @IsOptional()
  @IsIn(['createdAt', 'resultsCnt', 'readCnt', 'sessionId', 'query'])
  sortBy?: 'createdAt' | 'resultsCnt' | 'readCnt' | 'sessionId' | 'query';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: '排序方向（預設 desc）' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

