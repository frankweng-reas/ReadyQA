/**
 * Chatbot 驗證 Schema
 */
import { z } from 'zod';

export const createChatbotSchema = z.object({
  user_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  welcome_message: z.string().max(1000).optional(),
  placeholder: z.string().max(200).optional(),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateChatbotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  welcome_message: z.string().max(1000).optional(),
  placeholder: z.string().max(200).optional(),
  theme_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_active: z.boolean().optional(),
});

export type CreateChatbotInput = z.infer<typeof createChatbotSchema>;
export type UpdateChatbotInput = z.infer<typeof updateChatbotSchema>;

