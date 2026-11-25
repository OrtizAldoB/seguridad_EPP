import type { NextFunction, Request, Response } from 'express';
import { ROLES, type RolCodigo } from '../shared/constants';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';

type Guard = (req: Request, res: Response, next: NextFunction) => void;

function ensureUser(req: Request, next: NextFunction): boolean {
  if (!req.user) {
    next(new UnauthorizedError());
    return false;
  }
  return true;
}

export function requireRole(...roles: RolCodigo[]): Guard {
  return (req, _res, next) => {
    if (!ensureUser(req, next)) return;
    if (req.user?.role === ROLES.ADMINISTRADOR) {
      next();
      return;
    }
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

export function requirePermiso(...permisos: string[]): Guard {
  return (req, _res, next) => {
    if (!ensureUser(req, next)) return;
    if (req.user?.role === ROLES.ADMINISTRADOR) {
      next();
      return;
    }
    const granted = req.user?.permisos ?? [];
    if (!permisos.every((permiso) => granted.includes(permiso))) {
      next(new ForbiddenError(`Se requiere el permiso: ${permisos.join(', ')}`));
      return;
    }
    next();
  };
}
