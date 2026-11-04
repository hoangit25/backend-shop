import { HttpStatus } from './http-status';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode: string;

  constructor(
    statusCode: number,
    message: string,
    errorCode?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode || this.deriveErrorCode(statusCode);
    Error.captureStackTrace(this, this.constructor);
  }

  private deriveErrorCode(statusCode: number): string {
    const codeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };
    return codeMap[statusCode] || 'UNKNOWN_ERROR';
  }

  static BadRequest(message = 'Bad request', errorCode?: string) {
    return new AppError(HttpStatus.BAD_REQUEST, message, errorCode);
  }

  static Unauthorized(message = 'Unauthorized', errorCode?: string) {
    return new AppError(HttpStatus.UNAUTHORIZED, message, errorCode);
  }

  static Forbidden(message = 'Forbidden', errorCode?: string) {
    return new AppError(HttpStatus.FORBIDDEN, message, errorCode);
  }

  static NotFound(message = 'Resource not found', errorCode?: string) {
    return new AppError(HttpStatus.NOT_FOUND, message, errorCode);
  }

  static Conflict(message = 'Resource already exists', errorCode?: string) {
    return new AppError(HttpStatus.CONFLICT, message, errorCode);
  }

  static Internal(message = 'Internal server error', errorCode?: string) {
    return new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      errorCode,
      false
    );
  }
}
