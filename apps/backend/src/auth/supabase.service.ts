import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    // 優先使用 NEXT_PUBLIC_ 變數（與前端共用）
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and ANON_KEY must be provided');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async verifyToken(token: string) {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  }
}

