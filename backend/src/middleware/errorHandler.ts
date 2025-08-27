import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

// Custom error class
export class CustomError extends Error implements ApiError {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'CustomError';
  }
}

// Error handler middleware
export const errorHandler = (
  error: Error | ApiError | Prisma.PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Log error for debugging
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Handle custom errors
  if (error instanceof CustomError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
  }
  
  // Handle Prisma errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint failed
        const target = error.meta?.target as string[] | undefined;
        const field = target ? target[0] : 'field';
        statusCode = 409;
        message = `A record with this ${field} already exists`;
        code = 'DUPLICATE_ENTRY';
        details = { field, constraint: 'unique' };
        break;

      case 'P2014':
        // Required relation violation
        statusCode = 400;
        message = 'Invalid relation: required field is missing';
        code = 'INVALID_RELATION';
        break;

      case 'P2003':
        // Foreign key constraint failed
        statusCode = 400;
        message = 'Invalid reference: related record does not exist';
        code = 'FOREIGN_KEY_VIOLATION';
        break;

      case 'P2025':
        // Record not found
        statusCode = 404;
        message = 'Record not found';
        code = 'NOT_FOUND';
        break;

      case 'P2021':
        // Table does not exist
        statusCode = 500;
        message = 'Database configuration error';
        code = 'DATABASE_ERROR';
        break;

      case 'P2022':
        // Column does not exist
        statusCode = 500;
        message = 'Database schema error';
        code = 'DATABASE_ERROR';
        break;

      default:
        statusCode = 500;
        message = 'Database operation failed';
        code = 'DATABASE_ERROR';
        details = { prismaCode: error.code };
    }
  }
  
  // Handle Prisma validation errors
  else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  }
  
  // Handle Prisma connection errors
  else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = 'Database connection failed';
    code = 'DATABASE_CONNECTION_ERROR';
  }
  
  // Handle JSON parsing errors
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON format';
    code = 'INVALID_JSON';
  }
  
  // Handle JWT errors (already handled in auth middleware, but just in case)
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    code = 'TOKEN_EXPIRED';
  }
  
  // Handle multer errors (file upload)
  else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
    code = 'UPLOAD_ERROR';
    
    // Specific multer error handling
    if ((error as any).code === 'LIMIT_FILE_SIZE') {
      message = 'File size too large';
    } else if ((error as any).code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    } else if ((error as any).code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
  }
  
  // Handle other known errors
  else if ('statusCode' in error && error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  }
  
  // Default to original message for unknown errors
  else if (error.message) {
    message = error.message;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Something went wrong. Please try again later.';
    details = undefined;
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: error.message
    })
  });
};

// Async error wrapper to catch errors in async route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Resource not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    message: `The requested resource ${req.originalUrl} was not found on this server.`
  });
};
