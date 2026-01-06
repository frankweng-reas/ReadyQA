/**
 * Tenant 驗證 Schema
 */
import { z } from 'zod';

export const tenantStatusSchema = z.enum(['active', 'suspended', 'trial']);

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  plan_code: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  status: tenantStatusSchema.default('trial'),
  trial_days: z.number().int().positive().max(90).default(14),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  plan_code: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  status: tenantStatusSchema.optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

