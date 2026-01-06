/**
 * 驗證工具函式
 */
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        'Validation failed',
        error.issues.map((e: any) => ({
          path: e.path.join('.'),
          message: e.message,
        }))
      );
    }
    throw error;
  }
}

export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: any[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e: any) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}

export function isUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function isEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

