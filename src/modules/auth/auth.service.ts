import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withImmediateTx } from '../../config/database';
import { env } from '../../config/env';
import { ROLES } from '../../shared/constants';
import type { TipoDocumento } from '../../shared/documentos';
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from '../../shared/errors';
import type { AuthUser } from '../../types/express';
import { createCliente, findClienteByNitCi } from '../clientes/clientes.repository';
import {
  createUsuario,
  findAuthUserById,
  findRolByCodigo,
  findUserByEmail,
  toPublicUser,
  updateUltimoAcceso,
  type PublicUser,
} from '../usuarios/usuarios.repository';
import { createSession, findActiveSession, revokeSession } from './sesiones.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresAt: string;
}

export interface LoginResult extends TokenPair {
  user: PublicUser;
}

export interface RegistrarInput {
  nombreCompleto: string;
  email: string;
  password: string;
  nitCi: string;
  tipoDocumento: TipoDocumento;
  telefono?: string;
  direccion?: string;
}

function signAccessToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

function buildTokenPair(user: AuthUser): TokenPair {
  const accessToken = signAccessToken(user);
  const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
  const session = withImmediateTx(() => createSession(user.id));

  return {
    accessToken,
    refreshToken: session.token,
    tokenType: 'Bearer',
    expiresIn: (decoded.exp ?? 0) - (decoded.iat ?? 0),
    refreshExpiresAt: session.expiraEn,
  };
}

export function login(email: string, password: string): LoginResult {
  const row = findUserByEmail(email);

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new UnauthorizedError('Credenciales invalidas');
  }
  if (row.activo !== 1) {
    throw new UnauthorizedError('Usuario inactivo');
  }

  const user = findAuthUserById(row.id);
  if (!user) throw new UnauthorizedError('Credenciales invalidas');

  withImmediateTx(() => updateUltimoAcceso(user.id));

  return { user: { ...toPublicUser(row), permisos: user.permisos } as any, ...buildTokenPair(user) };
}

export function registrar(input: RegistrarInput): LoginResult {
  if (findUserByEmail(input.email)) throw new ConflictError('El correo electronico ya esta registrado');
  if (findClienteByNitCi(input.nitCi)) throw new ConflictError('El NIT/CI ya esta registrado');

  const rol = findRolByCodigo(ROLES.COMPRADOR);
  if (!rol) throw new BadRequestError('El rol comprador no esta disponible');

  const row = withImmediateTx(() => {
    const cliente = createCliente({
      razonSocial: input.nombreCompleto,
      nitCi: input.nitCi,
      tipoDocumento: input.tipoDocumento,
      telefono: input.telefono,
      email: input.email,
      direccion: input.direccion,
      estado: 'ACTIVO',
    });
    return createUsuario({
      nombreCompleto: input.nombreCompleto,
      email: input.email,
      passwordHash: bcrypt.hashSync(input.password, env.BCRYPT_ROUNDS),
      rolId: rol.id,
      activo: true,
      clienteId: cliente.id,
    });
  });

  const user = findAuthUserById(row.id);
  if (!user) throw new BadRequestError('No se pudo crear la cuenta');
  return { user: { ...toPublicUser(row), permisos: user.permisos } as any, ...buildTokenPair(user) };
}

export function refresh(refreshToken: string): TokenPair {
  const session = findActiveSession(refreshToken);
  if (!session) throw new UnauthorizedError('Sesion invalida o expirada');

  const user = findAuthUserById(session.usuario_id);
  if (!user || !user.activo) throw new UnauthorizedError('Usuario inactivo');

  const accessToken = signAccessToken(user);
  const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
  const rotated = withImmediateTx(() => {
    revokeSession(session.id);
    return createSession(user.id);
  });

  return {
    accessToken,
    refreshToken: rotated.token,
    tokenType: 'Bearer',
    expiresIn: (decoded.exp ?? 0) - (decoded.iat ?? 0),
    refreshExpiresAt: rotated.expiraEn,
  };
}

export function logout(refreshToken: string, userId: number): void {
  const session = findActiveSession(refreshToken);
  if (!session) return;
  if (session.usuario_id !== userId) {
    throw new ForbiddenError('La sesion no pertenece al usuario autenticado');
  }
  revokeSession(session.id);
}
