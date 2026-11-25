import { db } from '../../config/database';
import type { TipoDocumento } from '../../shared/documentos';
import type { EstadoCliente } from './clientes.schema';

export interface ClienteRow {
  id: number;
  razon_social: string;
  nit_ci: string;
  tipo_documento: TipoDocumento;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  estado: EstadoCliente;
  creado_en: string;
  actualizado_en: string;
}

export interface Cliente {
  id: number;
  razonSocial: string;
  nitCi: string;
  tipoDocumento: TipoDocumento;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  estado: EstadoCliente;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CreateClienteData {
  razonSocial: string;
  nitCi: string;
  tipoDocumento: TipoDocumento;
  telefono?: string;
  email?: string;
  direccion?: string;
  estado: EstadoCliente;
}

export interface UpdateClienteData {
  razonSocial?: string;
  nitCi?: string;
  tipoDocumento?: TipoDocumento;
  telefono?: string;
  email?: string;
  direccion?: string;
  estado?: EstadoCliente;
}

export interface ListClientesFilters {
  q?: string;
  estado?: EstadoCliente;
  page: number;
  limit: number;
}

export function toCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    razonSocial: row.razon_social,
    nitCi: row.nit_ci,
    tipoDocumento: row.tipo_documento,
    telefono: row.telefono,
    email: row.email,
    direccion: row.direccion,
    estado: row.estado,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export function findClienteById(id: number): ClienteRow | undefined {
  return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as ClienteRow | undefined;
}

export function findClienteByNitCi(nitCi: string): ClienteRow | undefined {
  return db.prepare('SELECT * FROM clientes WHERE nit_ci = ? COLLATE NOCASE').get(nitCi) as ClienteRow | undefined;
}

export function listClientes(filters: ListClientesFilters): { items: Cliente[]; total: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push('(razon_social LIKE ? OR nit_ci LIKE ? OR email LIKE ?)');
    params.push(like, like, like);
  }
  if (filters.estado) {
    conditions.push('estado = ?');
    params.push(filters.estado);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS total FROM clientes ${where}`).get(...params) as { total: number }).total;
  const rows = db
    .prepare(`SELECT * FROM clientes ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as ClienteRow[];

  return { items: rows.map(toCliente), total };
}

export function createCliente(data: CreateClienteData): ClienteRow {
  const result = db
    .prepare(
      `INSERT INTO clientes (razon_social, nit_ci, tipo_documento, telefono, email, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.razonSocial, data.nitCi, data.tipoDocumento, data.telefono ?? null, data.email ?? null, data.direccion ?? null, data.estado);
  return findClienteById(Number(result.lastInsertRowid))!;
}

export function updateCliente(id: number, data: UpdateClienteData): void {
  const sets: string[] = [];
  const params: (string | number)[] = [];

  const fields: [keyof UpdateClienteData, string][] = [
    ['razonSocial', 'razon_social'],
    ['nitCi', 'nit_ci'],
    ['tipoDocumento', 'tipo_documento'],
    ['telefono', 'telefono'],
    ['email', 'email'],
    ['direccion', 'direccion'],
    ['estado', 'estado'],
  ];

  for (const [key, column] of fields) {
    const value = data[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (sets.length === 0) return;

  sets.push("actualizado_en = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE clientes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function deactivateCliente(id: number): void {
  db.prepare(`UPDATE clientes SET estado = 'INACTIVO', actualizado_en = datetime('now') WHERE id = ?`).run(id);
}
