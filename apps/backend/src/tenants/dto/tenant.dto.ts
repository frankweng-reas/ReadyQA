import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  planCode: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  planCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}

export class TenantQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  planCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}
