/**
 * Common types used across the application
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export type Status = 'active' | 'inactive' | 'draft' | 'archived';

export interface Timestamps {
  createdAt: Date | string;
  updatedAt: Date | string;
}

