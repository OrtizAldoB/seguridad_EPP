import bcrypt from 'bcryptjs';
import { withImmediateTx } from '../../config/database';
import { env } from '../../config/env';
import { ROLES } from '../../shared/constants';
import type { TipoDocumento } from '../../shared/documentos';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import type { AuthUser } from '../../types/express';
import { revokeAllSessions } from '../auth/sesiones.repository';
import * as clientesRepo from '../clientes/clientes.repository';
import * as repo from './usuarios.repository';
import type { ListUsuariosFilters, PublicUser, UpdateUsuarioData } from './usuarios.repository';

export interface CreateUsuarioInput {
  nombreCompleto: string;
  email: string;
  password: string;
  rolId: number;
  activo: boolean;
  nitCi?: string;
  tipoDocumento?: TipoDocumento;
  telefono?: string;
  direccion?: string;
}

function nitClienteGenerado(): string {
  let nit = '';
  do {
    nit = `${Date.now()}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  } while (clientesRepo.findClienteByNitCi(nit));
  return nit;
}

function clienteParaUsuario(
  data: Pick<CreateUsuarioInput, 'nombreCompleto' | 'email' | 'nitCi' | 'tipoDocumento' | 'telefono' | 'direccion'>,
): number {
  const nitCi = data.nitCi?.trim() || nitClienteGenerado();
  const existente = clientesRepo.findClienteByNitCi(nitCi);
  if (existente) return existente.id;
  return clientesRepo.createCliente({
    razonSocial: data.nombreCompleto,
    nitCi,
    tipoDocumento: data.tipoDocumento ?? 'NIT',
    telefono: data.telefono,
    email: data.email,
    direccion: data.direccion,
    estado: 'ACTIVO',
  }).id;
}

export function list(filters: ListUsuariosFilters): { items: PublicUser[]; total: number } {
  return repo.listUsuarios(filters);
}

export function getById(id: number): PublicUser {
  const row = repo.findUserById(id);
  if (!row) throw new NotFoundError('Usuario no encontrado');
  return repo.toPublicUser(row);
}

export function create(data: CreateUsuarioInput): PublicUser {
  return withImmediateTx(() => {
    if (repo.findUserByEmail(data.email)) throw new ConflictError('El correo electronico ya esta registrado');
    if (!repo.findRolById(data.rolId)) throw new BadRequestError('El rol indicado no existe');

    const clienteId = clienteParaUsuario(data);
    return repo.toPublicUser(
      repo.createUsuario({
        nombreCompleto: data.nombreCompleto,
        email: data.email,
        passwordHash: bcrypt.hashSync(data.password, env.BCRYPT_ROUNDS),
        rolId: data.rolId,
        activo: data.activo,
        clienteId,
      }),
    );
  });
}

function assertNotLastAdmin(row: repo.UsuarioRow, data: UpdateUsuarioData): void {
  if (row.rol_codigo !== ROLES.ADMINISTRADOR || row.activo !== 1) return;
  const leavesAdminRole =
    data.activo === false ||
    (data.rolId !== undefined && repo.findRolById(data.rolId)?.codigo !== ROLES.ADMINISTRADOR);
  if (leavesAdminRole && repo.countActiveAdmins() <= 1) {
    throw new ForbiddenError('No se puede desactivar o cambiar el rol del unico administrador activo');
  }
}

export function update(id: number, data: UpdateUsuarioData, actor: AuthUser): PublicUser {
  return withImmediateTx(() => {
    const row = repo.findUserById(id);
    if (!row) throw new NotFoundError('Usuario no encontrado');

    if (data.email !== undefined) {
      const other = repo.findUserByEmail(data.email);
      if (other && other.id !== id) throw new ConflictError('El correo electronico ya esta registrado');
    }
    if (data.nitCi !== undefined) {
      const other = clientesRepo.findClienteByNitCi(data.nitCi);
      if (other && other.id !== row.cliente_id) throw new ConflictError('El NIT/CI ya esta registrado en otro cliente');
    }
    if (data.rolId !== undefined && !repo.findRolById(data.rolId)) {
      throw new BadRequestError('El rol indicado no existe');
    }
    if (actor.id === id && (data.activo === false || (data.rolId !== undefined && data.rolId !== row.rol_id))) {
      throw new ForbiddenError('No puede desactivarse ni cambiar su propio rol');
    }

    assertNotLastAdmin(row, data);
    repo.updateUsuario(id, data);

    actualizarClienteDelUsuario(id, data);
    return getById(id);
  });
}

function actualizarClienteDelUsuario(id: number, data: UpdateUsuarioData): void {
  const tieneDatosCliente =
    data.nombreCompleto !== undefined ||
    data.nitCi !== undefined ||
    data.tipoDocumento !== undefined ||
    data.telefono !== undefined ||
    data.direccion !== undefined ||
    data.email !== undefined;
  if (!tieneDatosCliente) return;

  const usuario = repo.findUserById(id);
  if (!usuario) return;
  const clienteId = usuario.cliente_id ?? clienteParaUsuario({
    nombreCompleto: usuario.nombre_completo,
    email: usuario.email,
  });
  if (usuario.cliente_id === null) repo.updateUsuario(id, { clienteId });
  clientesRepo.updateCliente(clienteId, {
    razonSocial: data.nombreCompleto ?? usuario.nombre_completo,
    nitCi: data.nitCi,
    tipoDocumento: data.tipoDocumento,
    telefono: data.telefono,
    direccion: data.direccion,
    email: data.email ?? usuario.email,
  });
}

export function deactivate(id: number, actor: AuthUser): PublicUser {
  return update(id, { activo: false }, actor);
}

export function changePassword(id: number, currentPassword: string, newPassword: string): void {
  const row = repo.findUserById(id);
  if (!row) throw new NotFoundError('Usuario no encontrado');
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw new ForbiddenError('La contrasena actual es incorrecta');
  }
  repo.updatePassword(id, bcrypt.hashSync(newPassword, env.BCRYPT_ROUNDS));
  revokeAllSessions(id);
}

export function catalogs(): {
  roles: ReturnType<typeof repo.listRoles>;
  permisos: ReturnType<typeof repo.listPermisos>;
} {
  return { roles: repo.listRoles(), permisos: repo.listPermisos() };
}
