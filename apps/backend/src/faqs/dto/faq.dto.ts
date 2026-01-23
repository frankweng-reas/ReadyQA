import { IsString, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFaqDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  topicId?: string;

  @ApiProperty()
  @IsString()
  question: string;

  @ApiProperty()
  @IsString()
  answer: string;

  @ApiProperty()
  @IsString()
  synonym: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  layout?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  images?: string;
}

export class UpdateFaqDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  question?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  answer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  synonym?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  layout?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  images?: string;
}

export class FaqQueryDto {
  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  topicId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number = 500;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  offset?: number = 0;
}

export class BulkUploadFaqItemDto {
  @ApiProperty()
  @IsString()
  question: string;

  @ApiProperty()
  @IsString()
  answer: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  synonym?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  topicId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}

export class BulkUploadFaqDto {
  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiProperty({ type: [BulkUploadFaqItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUploadFaqItemDto)
  faqs: BulkUploadFaqItemDto[];
}

export class FaqSortOrderItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  sortOrder: number;
}

export class BatchUpdateSortOrderDto {
  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiProperty({ type: [FaqSortOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqSortOrderItemDto)
  updates: FaqSortOrderItemDto[];
}


