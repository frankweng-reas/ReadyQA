/**
 * Session 相關型別定義
 * Session 管理對話會話和查詢配額
 */

export interface Session {
  id: number;
  tenant_id: string;
  session_token: string;
  chatbot_id: number;
  query_count: number;
  query_limit: number;
  created_at: Date;
  expires_at: Date;
  is_active: boolean;
}

export interface CreateSessionDto {
  tenant_id: string;
  chatbot_id: number;
  query_limit?: number;
  expires_in_days?: number;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: Session;
  error?: string;
  remaining_queries?: number;
}

export interface SessionStats {
  total_sessions: number;
  active_sessions: number;
  total_queries: number;
  avg_queries_per_session: number;
}

