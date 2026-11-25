import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isForeignKeyConstraint, isUniqueConstraint } from '../config/database';
import { env } from '../config/env';
import { AppError, BadRequestError, ConflictError, NotFoundError, ValidationError } from '../shared/errors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Ruta ${req.method} ${req.originalUrl} no encontrada`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = new ValidationError('Datos invalidos', err.flatten());
  } else if (isUniqueConstraint(err)) {
    error = new ConflictError('Ya existe un registro con ese valor unico');
  } else if (isForeignKeyConstraint(err)) {
    error = new BadRequestError('La referencia indicada no existe');
  } else if (err instanceof SyntaxError && 'body' in err) {
    error = new BadRequestError('JSON mal formado');
  } else {
    error = new AppError(500, err instanceof Error ? err.message : String(err), 'INTERNAL_ERROR');
  }

  if (error.statusCode >= 500) console.error('[error]', err);

  const message =
    error.statusCode >= 500 && env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : error.message;

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  });
};
