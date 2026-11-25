import type { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function ok<T>(
  res: Response,
  data: T,
  options: { message?: string; meta?: Record<string, unknown>; status?: number } = {},
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (options.message) body.message = options.message;
  if (options.meta) body.meta = options.meta;
  return res.status(options.status ?? 200).json(body);
}

export function created<T>(res: Response, data: T, message?: string): Response {
  return ok(res, data, { status: 201, message });
}
