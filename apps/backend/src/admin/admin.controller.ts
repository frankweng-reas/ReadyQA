import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
}
