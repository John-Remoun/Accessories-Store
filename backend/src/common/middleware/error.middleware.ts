import { Request, Response, NextFunction } from 'express';
import { AppError } from '../exceptions/app-error';

function sanitizeLogMessage(message: string): string {
  // Redact potential passwords, tokens, or connection strings from logs
  return message
    .replace(/(password=)[^\s&]+/gi, '$1[REDACTED]')
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2')
    .replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, '$1[REDACTED]');
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : (err.status || 500);

  // Redact any sensitive substrings in server error logs
  const rawMessage = err.message || 'Internal Server Error';
  const sanitizedMessage = sanitizeLogMessage(rawMessage);

  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] [${req.method} ${req.originalUrl}]:`, sanitizedMessage);
  }

  // Safe client response: never leak database syntax errors or internal paths in production
  let clientMessage = isAppError ? err.message : 'Internal Server Error';
  if (process.env.NODE_ENV === 'development' && !isAppError) {
    clientMessage = rawMessage;
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
