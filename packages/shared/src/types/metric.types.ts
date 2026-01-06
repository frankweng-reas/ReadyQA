/**
 * Metric 相關型別定義
 * Metric 追蹤系統使用指標和成本
 */

export type MetricType = 'llm_call' | 'search' | 'api_call';
export type LLMProvider = 'openai' | 'azure_openai' | 'anthropic';

export interface Metric {
  id: number;
  tenant_id: string;
  chatbot_id?: number;
  session_token?: string;
  metric_type: MetricType;
  llm_provider?: LLMProvider;
  model_name?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
  api_endpoint?: string;
  response_time_ms?: number;
  created_at: Date;
}

export interface MetricsSummary {
  total_llm_calls: number;
  total_searches: number;
  total_api_calls: number;
  total_tokens: number;
  total_cost: number;
  avg_response_time: number;
}

export interface CostBreakdown {
  by_tenant: TenantCost[];
  by_model: ModelCost[];
  by_date: DateCost[];
}

export interface TenantCost {
  tenant_id: string;
  tenant_name: string;
  total_cost: number;
  total_calls: number;
  total_tokens: number;
}

export interface ModelCost {
  provider: LLMProvider;
  model: string;
  total_cost: number;
  total_calls: number;
  total_tokens: number;
}

export interface DateCost {
  date: string;
  total_cost: number;
  total_calls: number;
}

export interface APIStats {
  endpoint: string;
  method: string;
  total_calls: number;
  avg_response_time: number;
  error_rate: number;
}

