import { IsString, IsOptional, IsInt, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  maxQueries?: number;
}

export class SessionQueryDto {
  @ApiProperty()
  @IsString()
  chatbotId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  active?: boolean;

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
}

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  queryCount?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  maxQueries?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

