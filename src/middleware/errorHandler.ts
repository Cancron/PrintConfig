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
  if (res.headersSent) { _next(error); return; }
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image file must be 12 MB or smaller.' : error.message;
    res.status(400).json({ error: message });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (code === '23505') { res.status(409).json({ error: 'A record with this value already exists.' }); return; }
    if (code === '23503') { res.status(409).json({ error: 'This record is referenced by another record or references a missing record.' }); return; }
    if (code === '23502' || code === '23514') { res.status(400).json({ error: 'Required fields or values are invalid.' }); return; }
    if (code === '22P02') { res.status(400).json({ error: 'Invalid ID or data format.' }); return; }
  }
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : error.message || 'Request failed',
    details: statusCode < 500 && error instanceof ApiError ? error.details : undefined,
  });
};

