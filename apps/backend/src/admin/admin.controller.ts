import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: '取得所有 Users（僅 Admin）' })
  async getAllUsers() {
    const users = await this.adminService.getAllUsers();
    return {
      success: true,
      data: users,
      total: users.length,
    };
  }

  @Get('tenants')
  @ApiOperation({ summary: '取得所有 Tenants（僅 Admin）' })
  async getAllTenants() {
    const tenants = await this.adminService.getAllTenants();
    return {
      success: true,
      data: tenants,
      total: tenants.length,
    };
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: '更新 Tenant（僅 Admin）' })
  async updateTenant(
    @Param('id') id: string,
    @Body() body: { name?: string; planCode?: string; status?: string },
  ) {
    const tenant = await this.adminService.updateTenant(id, body);
    return {
      success: true,
      data: tenant,
    };
  }

  @Post('sync-es')
  @ApiOperation({ summary: '將 PostgreSQL FAQ 全量同步到 Elasticsearch（僅 Admin）' })
  @ApiQuery({ name: 'chatbotId', required: false, description: '指定 chatbotId 只同步單一 chatbot，省略則同步全部' })
  async syncEs(@Query('chatbotId') chatbotId?: string) {
    const result = await this.adminService.syncAllFaqsToEs(chatbotId);
    return {
      success: true,
      data: result,
      message: `同步完成：${result.success}/${result.total} 筆成功`,
    };
  }
}
