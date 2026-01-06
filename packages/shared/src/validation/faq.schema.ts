/**
 * FAQ 驗證 Schema
 */
import { z } from 'zod';

export const faqLayoutSchema = z.enum(['text', 'image', 'video', 'card']);
export const faqStatusSchema = z.enum(['draft', 'published', 'archived']);

export const createFaqSchema = z.object({
  chatbot_id: z.number().int().positive(),
  topic_id: z.number().int().positive().optional(),
  question: z.string().min(1).max(500),
  answer: z.string().min(1),
  layout: faqLayoutSchema.default('text'),
  images: z.string().optional(),
  video_url: z.string().url().optional(),
  status: faqStatusSchema.default('draft'),
  keywords: z.array(z.string()).optional(),
});

export const updateFaqSchema = z.object({
  topic_id: z.number().int().positive().optional().nullable(),
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).optional(),
  layout: faqLayoutSchema.optional(),
  images: z.string().optional(),
  video_url: z.string().url().optional().nullable(),
  status: faqStatusSchema.optional(),
  keywords: z.array(z.string()).optional(),
});

export const searchFaqSchema = z.object({
  chatbot_id: z.number().int().positive(),
  query: z.string().min(1),
  top_k: z.number().int().positive().max(50).default(10),
  min_score: z.number().min(0).max(1).default(0.5),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
export type SearchFaqInput = z.infer<typeof searchFaqSchema>;

