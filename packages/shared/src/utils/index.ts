/**
 * Export all utility functions
 */
export * from './date.utils';
export * from './validation.utils';

// Keep existing utilities
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

