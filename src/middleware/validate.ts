import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../shared/errors';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('Cuerpo de solicitud invalido', result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ValidationError('Parametros de ruta invalidos', result.error.flatten()));
      return;
    }
    req.params = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('Parametros de consulta invalidos', result.error.flatten()));
      return;
    }
    req.query = result.data;
    next();
  };
}
