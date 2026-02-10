import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: '方案代碼', example: 'starter' })
  @IsString()
  planCode: string;

  @ApiPropertyOptional({ description: '付款成功後導向的 URL' })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  successUrl?: string;

  @ApiPropertyOptional({ description: '付款取消後導向的 URL' })
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  cancelUrl?: string;
}
