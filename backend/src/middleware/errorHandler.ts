import type { ErrorRequestHandler } from 'express';
import multer from 'multer';

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image file must be 12 MB or smaller.' : error.message;
    res.status(400).json({ error: message });
    return;
  }
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  res.status(statusCode).json({
    error: error.message || 'Internal server error',
    details: error instanceof ApiError ? error.details : undefined,
  });
};

