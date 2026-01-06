/**
 * Plan 相關型別定義
 * Plan 定義租戶的服務方案和配額限制
 */

export type PlanCode = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Plan {
  code: PlanCode;
  name: string;
  price: number;
  currency: string;
  features: PlanFeatures;
}

export interface PlanFeatures {
  max_chatbots: number;
  max_faqs_per_chatbot: number;
  max_queries_per_day: number;
  max_queries_per_session: number;
  support_level: 'community' | 'email' | 'priority' | 'dedicated';
  custom_branding: boolean;
  api_access: boolean;
}

export interface QuotaUsage {
  tenant_id: string;
  plan_code: PlanCode;
  chatbot_count: number;
  chatbot_limit: number;
  faq_count: number;
  faq_limit: number;
  queries_today: number;
  queries_limit: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  current_usage: number;
  limit: number;
}

