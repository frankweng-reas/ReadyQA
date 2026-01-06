/**
 * User related types
 */

export interface User {
  userId: number;
  email: string;
  name: string;
  supabaseUserId?: string;
  tenantId?: string;
  isActive: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password?: string;
  supabaseUserId?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  isActive?: number;
}

export interface UserResponse {
  success: boolean;
  user: User;
  message?: string;
}

