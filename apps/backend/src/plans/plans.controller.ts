import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PlansService } from './plans.service';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得所有方案列表' })
  @ApiResponse({ status: 200, description: '成功取得方案列表' })
  async findAll() {
    const plans = await this.plansService.findAll();
    return {
      success: true,
      data: plans,
    };
  }

  @Get(':code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一方案詳情' })
  @ApiResponse({ status: 200, description: '成功取得方案' })
  @ApiResponse({ status: 404, description: '方案不存在' })
  async findOne(@Param('code') code: string) {
    const plan = await this.plansService.findOne(code);
    return {
      success: true,
      data: plan,
    };
  }
}

