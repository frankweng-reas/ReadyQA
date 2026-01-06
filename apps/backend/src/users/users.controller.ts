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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 User' })
  async create(@Body() createDto: CreateUserDto) {
    const user = await this.usersService.create(createDto);
    return {
      success: true,
      data: user,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 User 列表' })
  async findAll(@Query() query: UserQueryDto) {
    const users = await this.usersService.findAll(query);
    return {
      success: true,
      data: users,
      total: users.length,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 User' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(+id);
    return {
      success: true,
      data: user,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 User' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
    const user = await this.usersService.update(+id, updateDto);
    return {
      success: true,
      data: user,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 User' })
  async remove(@Param('id') id: string) {
    const user = await this.usersService.remove(+id);
    return {
      success: true,
      message: 'User deleted successfully',
      data: user,
    };
  }
}

