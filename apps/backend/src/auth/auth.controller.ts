import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { GetOrCreateUserDto } from './dto/get-or-create-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile (requires Supabase token)' })
  getProfile(@CurrentUser() user: any) {
    return {
      message: 'User profile retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
    };
  }

  @Post('get-or-create-user')
  @ApiOperation({ summary: 'Get or create user by Supabase UUID' })
  async getOrCreateUser(@Body() dto: GetOrCreateUserDto) {
    return this.authService.getOrCreateUser(dto);
  }
}

