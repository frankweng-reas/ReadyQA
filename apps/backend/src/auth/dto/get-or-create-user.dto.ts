import { IsString, IsEmail, IsOptional } from 'class-validator';

export class GetOrCreateUserDto {
  @IsString()
  supabaseUserId: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class GetOrCreateUserResponseDto {
  success: boolean;
  message: string;
  userId: number;
  created: boolean;
}

