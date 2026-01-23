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
  async getProfile(@CurrentUser() supabaseUser: any) {
    const userProfile = await this.authService.getUserProfile(supabaseUser.id);
    
    if (!userProfile) {
      return {
        success: false,
        message: 'User profile not found',
      };
    }

    return {
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        id: userProfile.id,
        email: userProfile.email,
        username: userProfile.username,
        tenantId: userProfile.tenantId,
        tenant: userProfile.tenant ? {
          id: userProfile.tenant.id,
          name: userProfile.tenant.name,
          planCode: userProfile.tenant.planCode,
          plan: userProfile.tenant.plan,
        } : null,
        quota: userProfile.quota,
      },
    };
  }

  @Post('get-or-create-user')
  @ApiOperation({ summary: 'Get or create user by Supabase UUID' })
  async getOrCreateUser(@Body() dto: GetOrCreateUserDto) {
    return this.authService.getOrCreateUser(dto);
  }
}

