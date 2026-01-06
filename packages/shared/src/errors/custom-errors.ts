/**
 * 自定義錯誤類型
 */
import { ErrorCode, ErrorMessages, ErrorStatusCodes } from './error-codes';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: any,
    isOperational = true
  ) {
    super(message || ErrorMessages[code]);
    this.code = code;
    this.statusCode = ErrorStatusCodes[code];
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message?: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super(
      ErrorCode.NOT_FOUND,
      `${resource} ${id ? `with id ${id}` : ''} not found`
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message?: string) {
    super(ErrorCode.FORBIDDEN, message);
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string, limit: number) {
    super(
      ErrorCode.TENANT_QUOTA_EXCEEDED,
      `${resource} quota exceeded (limit: ${limit})`
    );
  }
}

export class SessionError extends AppError {
  constructor(code: ErrorCode, message?: string) {
    super(code, message);
  }
}

export class DatabaseError extends AppError {
  constructor(message?: string, details?: any) {
    super(ErrorCode.DATABASE_ERROR, message, details, false);
  }
}

