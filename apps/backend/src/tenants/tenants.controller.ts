import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, TenantQueryDto } from './dto/tenant.dto';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 Tenant' })
  async create(@Body() createDto: CreateTenantDto) {
    const tenant = await this.tenantsService.create(createDto);
    return {
      success: true,
      data: tenant,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Tenant 列表' })
  async findAll(@Query() query: TenantQueryDto) {
    const tenants = await this.tenantsService.findAll(query);
    return {
      success: true,
      data: tenants,
      total: tenants.length,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 Tenant' })
  async findOne(@Param('id') id: string) {
    const tenant = await this.tenantsService.findOne(id);
    return {
      success: true,
      data: tenant,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 Tenant' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateTenantDto) {
    const tenant = await this.tenantsService.update(id, updateDto);
    return {
      success: true,
      data: tenant,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 Tenant' })
  async remove(@Param('id') id: string) {
    await this.tenantsService.remove(id);
    return {
      success: true,
      message: 'Tenant deleted successfully',
    };
  }
}

