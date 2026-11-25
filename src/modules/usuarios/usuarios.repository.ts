import { db } from '../../config/database';
import type { RolCodigo } from '../../shared/constants';
import type { TipoDocumento } from '../../shared/documentos';
import type { AuthUser } from '../../types/express';

export interface UsuarioRow {
  id: number;
  nombre_completo: string;
  email: string;
  password_hash: string;
  rol_id: number;
  cliente_id: number | null;
  activo: number;
  creado_en: string;
  actualizado_en: string;
  ultimo_acceso_en: string | null;
  rol_codigo: RolCodigo;
  rol_nombre: string;
}

export interface PublicUser {
  id: number;
  nombreCompleto: string;
  email: string;
  role: RolCodigo;
  roleNombre: string;
  clienteId: number | null;
  activo: boolean;
  creadoEn: string;
  ultimoAccesoEn: string | null;
}

export interface CreateUsuarioData {
  nombreCompleto: string;
  email: string;
  passwordHash: string;
  rolId: number;
  activo: boolean;
  clienteId?: number | null;
}

export interface UpdateUsuarioData {
  clienteId?: number | null;
  nombreCompleto?: string;
  email?: string;
  rolId?: number;
  activo?: boolean;
  nitCi?: string;
  tipoDocumento?: TipoDocumento;
  telefono?: string;
  direccion?: string;
}

export interface ListUsuariosFilters {
  q?: string;
  role?: RolCodigo;
  activo?: boolean;
  page: number;
  limit: number;
}

const BASE_SELECT = `
  SELECT u.id, u.nombre_completo, u.email, u.password_hash, u.rol_id, u.cliente_id,
          u.activo, u.creado_en, u.actualizado_en, u.ultimo_acceso_en,
         r.codigo AS rol_codigo, r.nombre AS rol_nombre
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
`;

export function toPublicUser(row: UsuarioRow): PublicUser {
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    email: row.email,
    role: row.rol_codigo,
    roleNombre: row.rol_nombre,
    clienteId: row.cliente_id,
    activo: row.activo === 1,
    creadoEn: row.creado_en,
    ultimoAccesoEn: row.ultimo_acceso_en,
  };
}

export function findUserByEmail(email: string): UsuarioRow | undefined {
  return db.prepare(`${BASE_SELECT} WHERE u.email = ? COLLATE NOCASE`).get(email) as UsuarioRow | undefined;
}

export function findUserById(id: number): UsuarioRow | undefined {
  return db.prepare(`${BASE_SELECT} WHERE u.id = ?`).get(id) as UsuarioRow | undefined;
}

export function findClienteIdByUsuarioId(id: number): number | null {
  const row = db.prepare('SELECT cliente_id FROM usuarios WHERE id = ?').get(id) as { cliente_id: number | null } | undefined;
  return row?.cliente_id ?? null;
}

export function listPermisosByRolId(rolId: number): string[] {
  const rows = db
    .prepare(
      `SELECT p.codigo FROM permisos p
       JOIN rol_permisos rp ON rp.permiso_id = p.id
       WHERE rp.rol_id = ? ORDER BY p.codigo`,
    )
    .all(rolId) as { codigo: string }[];
  return rows.map((row) => row.codigo);
}

export function findAuthUserById(id: number): AuthUser | undefined {
  const row = findUserById(id);
  if (!row) return undefined;
  return {
    id: row.id,
    nombreCompleto: row.nombre_completo,
    email: row.email,
    role: row.rol_codigo,
    roleNombre: row.rol_nombre,
    permisos: listPermisosByRolId(row.rol_id),
    activo: row.activo === 1,
  };
}

export function updateUltimoAcceso(id: number): void {
  db.prepare(`UPDATE usuarios SET ultimo_acceso_en = datetime('now') WHERE id = ?`).run(id);
}

export function listUsuarios(filters: ListUsuariosFilters): { items: PublicUser[]; total: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push('(u.nombre_completo LIKE ? OR u.email LIKE ?)');
    params.push(like, like);
  }
  if (filters.role) {
    conditions.push('r.codigo = ?');
    params.push(filters.role);
  }
  if (filters.activo !== undefined) {
    conditions.push('u.activo = ?');
    params.push(filters.activo ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM usuarios u JOIN roles r ON r.id = u.rol_id ${where}`).get(...params) as {
      total: number;
    }
  ).total;
  const rows = db
    .prepare(`${BASE_SELECT} ${where} ORDER BY u.id DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as UsuarioRow[];

  return { items: rows.map(toPublicUser), total };
}

export function createUsuario(data: CreateUsuarioData): UsuarioRow {
  const result = db
    .prepare(
      `INSERT INTO usuarios (nombre_completo, email, password_hash, rol_id, activo, cliente_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.nombreCompleto,
      data.email.toLowerCase(),
      data.passwordHash,
      data.rolId,
      data.activo ? 1 : 0,
      data.clienteId ?? null,
    );
  return findUserById(Number(result.lastInsertRowid))!;
}

export function updateUsuario(id: number, data: UpdateUsuarioData): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (data.clienteId !== undefined) {
    sets.push('cliente_id = ?');
    params.push(data.clienteId);
  }
  if (data.nombreCompleto !== undefined) {
    sets.push('nombre_completo = ?');
    params.push(data.nombreCompleto);
  }
  if (data.email !== undefined) {
    sets.push('email = ?');
    params.push(data.email.toLowerCase());
  }
  if (data.rolId !== undefined) {
    sets.push('rol_id = ?');
    params.push(data.rolId);
  }
  if (data.activo !== undefined) {
    sets.push('activo = ?');
    params.push(data.activo ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push("actualizado_en = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function updatePassword(id: number, passwordHash: string): void {
  db.prepare(`UPDATE usuarios SET password_hash = ?, actualizado_en = datetime('now') WHERE id = ?`).run(
    passwordHash,
    id,
  );
}

export function countActiveAdmins(excludeId?: number): number {
  const sql = `
    SELECT COUNT(*) AS total FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE r.codigo = 'ADMINISTRADOR' AND u.activo = 1
    ${excludeId !== undefined ? 'AND u.id <> ?' : ''}
  `;
  const statement = db.prepare(sql);
  const row = (excludeId !== undefined ? statement.get(excludeId) : statement.get()) as { total: number };
  return row.total;
}

export function listRoles(): { id: number; codigo: RolCodigo; nombre: string; descripcion: string | null }[] {
  return db.prepare('SELECT id, codigo, nombre, descripcion FROM roles ORDER BY id').all() as {
    id: number;
    codigo: RolCodigo;
    nombre: string;
    descripcion: string | null;
  }[];
}

export function findRolById(id: number): { id: number; codigo: RolCodigo } | undefined {
  return db.prepare('SELECT id, codigo FROM roles WHERE id = ?').get(id) as
    | { id: number; codigo: RolCodigo }
    | undefined;
}

export function findRolByCodigo(codigo: RolCodigo): { id: number; codigo: RolCodigo } | undefined {
  return db.prepare('SELECT id, codigo FROM roles WHERE codigo = ?').get(codigo) as
    | { id: number; codigo: RolCodigo }
    | undefined;
}

export function listPermisos(): { id: number; codigo: string; modulo: string; accion: string }[] {
  return db.prepare('SELECT id, codigo, modulo, accion FROM permisos ORDER BY codigo').all() as {
    id: number;
    codigo: string;
    modulo: string;
    accion: string;
  }[];
}
