/**
 * Session 驗證 Schema
 */
import { z } from 'zod';

export const createSessionSchema = z.object({
  tenant_id: z.string().uuid(),
  chatbot_id: z.number().int().positive(),
  query_limit: z.number().int().positive().default(100),
  expires_in_days: z.number().int().positive().max(365).default(30),
});

export const validateSessionSchema = z.object({
  session_token: z.string().uuid(),
  chatbot_id: z.number().int().positive(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type ValidateSessionInput = z.infer<typeof validateSessionSchema>;

