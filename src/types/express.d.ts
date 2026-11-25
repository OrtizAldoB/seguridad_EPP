import type { RolCodigo } from '../shared/constants';

export interface AuthUser {
  id: number;
  nombreCompleto: string;
  email: string;
  role: RolCodigo;
  roleNombre: string;
  permisos: string[];
  activo: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}

export {};
