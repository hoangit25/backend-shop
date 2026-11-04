import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/appError';
import { HttpStatus } from '../common/http-status';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  if (err instanceof ZodError) {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (err.code === 11000) {
    const keyPattern = err.keyPattern || {};
    const field = Object.keys(keyPattern)[0] || 'unknown';
    return res.status(HttpStatus.CONFLICT).json({
      success: false,
      message: `Duplicate value for field: ${field}`,
      errorCode: 'DUPLICATE_KEY',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Token has expired',
      errorCode: 'TOKEN_EXPIRED',
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid token',
      errorCode: 'INVALID_TOKEN',
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errorCode: 'MONGOOSE_VALIDATION',
      errors: Object.values(err.errors || {}).map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  if (err.name === 'CastError') {
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: `Invalid value for ${err.path}: ${err.value}`,
      errorCode: 'INVALID_ID',
    });
  }

  console.error('⚠️  Unexpected Error:', err);

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error',
    errorCode: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
