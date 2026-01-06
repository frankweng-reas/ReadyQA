/**
 * Tenant 相關型別定義
 * Tenant 是多租戶系統的核心實體
 */

export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface Tenant {
  id: string;
  name: string;
  email: string;
  plan_code: string;
  status: TenantStatus;
  created_at: Date;
  updated_at: Date;
  trial_ends_at?: Date;
}

export interface CreateTenantDto {
  name: string;
  email: string;
  plan_code?: string;
  status?: TenantStatus;
  trial_days?: number;
}

export interface UpdateTenantDto {
  name?: string;
  email?: string;
  plan_code?: string;
  status?: TenantStatus;
}

export interface TenantWithUsage extends Tenant {
  chatbot_count: number;
  faq_count: number;
  query_count_today: number;
  total_cost: number;
}

