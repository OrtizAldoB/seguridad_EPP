import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { findAuthUserById } from '../modules/usuarios/usuarios.repository';
import { UnauthorizedError } from '../shared/errors';

type AccessPayload = Omit<jwt.JwtPayload, 'sub'> & {
  sub?: number | string;
  typ?: string;
};

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de acceso requerido'));
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    next(new UnauthorizedError('Token de acceso requerido'));
    return;
  }

  let payload: AccessPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  } catch {
    next(new UnauthorizedError('Token de acceso invalido o expirado'));
    return;
  }

  if (payload.typ !== 'access' || typeof payload.sub !== 'number') {
    next(new UnauthorizedError('Token de acceso invalido'));
    return;
  }

  const user = findAuthUserById(payload.sub);
  if (!user || !user.activo) {
    next(new UnauthorizedError('Usuario inactivo o no encontrado'));
    return;
  }

  req.user = user;
  next();
}
