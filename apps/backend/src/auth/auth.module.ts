import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotaService } from '../common/quota.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [SupabaseService, SupabaseAuthGuard, AuthService, QuotaService],
  exports: [SupabaseService, SupabaseAuthGuard, AuthService],
})
export class AuthModule {}


