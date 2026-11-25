import { db } from '../../config/database';
import type { EstadoSolicitud } from './solicitudes.schema';

export interface SolicitudRow {
  id: number;
  codigo: string;
  proveedor_id: number;
  usuario_id: number;
  estado: EstadoSolicitud;
  observacion: string | null;
  motivo_rechazo: string | null;
  compra_id: number | null;
  compra_codigo: string | null;
  aprobado_por: number | null;
  aprobado_por_nombre_completo: string | null;
  aprobado_en: string | null;
  creado_en: string;
  actualizado_en: string;
  proveedor_razon_social: string;
  proveedor_nit_ci: string;
  usuario_nombre_completo: string;
}

export interface SolicitudItemRow {
  id: number;
  solicitud_id: number;
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  cantidad: number;
}

export interface SolicitudItem {
  id: number;
  solicitudId: number;
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
}

export interface Solicitud {
  id: number;
  codigo: string;
  proveedorId: number;
  proveedorRazonSocial: string;
  proveedorNitCi: string;
  usuarioId: number;
  usuarioNombreCompleto: string;
  estado: EstadoSolicitud;
  observacion: string | null;
  motivoRechazo: string | null;
  compraId: number | null;
  compraCodigo: string | null;
  aprobadoPor: number | null;
  aprobadoPorNombreCompleto: string | null;
  aprobadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

const BASE = `
  SELECT s.*, c.codigo AS compra_codigo,
         p.razon_social AS proveedor_razon_social, p.nit_ci AS proveedor_nit_ci,
         u.nombre_completo AS usuario_nombre_completo,
         a.nombre_completo AS aprobado_por_nombre_completo
  FROM solicitudes_compra s
  JOIN proveedores p ON p.id = s.proveedor_id
  JOIN usuarios u ON u.id = s.usuario_id
  LEFT JOIN compras c ON c.id = s.compra_id
  LEFT JOIN usuarios a ON a.id = s.aprobado_por`;

export function toSolicitud(row: SolicitudRow): Solicitud {
  return {
    id: row.id,
    codigo: row.codigo,
    proveedorId: row.proveedor_id,
    proveedorRazonSocial: row.proveedor_razon_social,
    proveedorNitCi: row.proveedor_nit_ci,
    usuarioId: row.usuario_id,
    usuarioNombreCompleto: row.usuario_nombre_completo,
    estado: row.estado,
    observacion: row.observacion,
    motivoRechazo: row.motivo_rechazo,
    compraId: row.compra_id,
    compraCodigo: row.compra_codigo,
    aprobadoPor: row.aprobado_por,
    aprobadoPorNombreCompleto: row.aprobado_por_nombre_completo,
    aprobadoEn: row.aprobado_en,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export function toItem(row: SolicitudItemRow): SolicitudItem {
  return {
    id: row.id,
    solicitudId: row.solicitud_id,
    productoId: row.producto_id,
    productoCodigo: row.producto_codigo,
    productoNombre: row.producto_nombre,
    cantidad: row.cantidad,
  };
}

export function findSolicitudById(id: number): SolicitudRow | undefined {
  return db.prepare(`${BASE} WHERE s.id = ?`).get(id) as SolicitudRow | undefined;
}

export function listSolicitudes(f: {
  q?: string;
  estado?: EstadoSolicitud;
  proveedor_id?: number;
  page: number;
  limit: number;
}): { items: Solicitud[]; total: number } {
  const cond: string[] = [];
  const params: (string | number)[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    cond.push('(s.codigo LIKE ? OR p.razon_social LIKE ? OR p.nit_ci LIKE ?)');
    params.push(like, like, like);
  }
  if (f.estado) {
    cond.push('s.estado = ?');
    params.push(f.estado);
  }
  if (f.proveedor_id) {
    cond.push('s.proveedor_id = ?');
    params.push(f.proveedor_id);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM solicitudes_compra s JOIN proveedores p ON p.id = s.proveedor_id ${where}`).get(...params) as { total: number }
  ).total;
  const rows = db
    .prepare(`${BASE} ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`)
    .all(...params, f.limit, (f.page - 1) * f.limit) as SolicitudRow[];
  return { items: rows.map(toSolicitud), total };
}

export function listItems(solicitudId: number): SolicitudItem[] {
  const rows = db
    .prepare(
      `SELECT d.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre
       FROM solicitud_compra_detalles d
       JOIN productos_epp p ON p.id = d.producto_id
       WHERE d.solicitud_id = ? ORDER BY d.id`,
    )
    .all(solicitudId) as SolicitudItemRow[];
  return rows.map(toItem);
}

export function nextCodigo(): string {
  const row = db.prepare("SELECT COUNT(*) AS n FROM solicitudes_compra WHERE date(creado_en)=date('now')").get() as { n: number };
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `SOL-${ymd}-${String(row.n + 1).padStart(4, '0')}`;
}

export function createSolicitud(data: {
  codigo: string;
  proveedorId: number;
  usuarioId: number;
  observacion?: string;
}): SolicitudRow {
  const result = db
    .prepare(
      `INSERT INTO solicitudes_compra (codigo, proveedor_id, usuario_id, estado, observacion)
       VALUES (?, ?, ?, 'PENDIENTE', ?)`,
    )
    .run(data.codigo, data.proveedorId, data.usuarioId, data.observacion ?? null);
  return findSolicitudById(Number(result.lastInsertRowid))!;
}

export function insertDetalle(data: { solicitudId: number; productoId: number; cantidad: number }): void {
  db.prepare(
    'INSERT INTO solicitud_compra_detalles (solicitud_id, producto_id, cantidad) VALUES (?, ?, ?)',
  ).run(data.solicitudId, data.productoId, data.cantidad);
}

export function updateDecision(
  id: number,
  decision: 'APROBADA' | 'RECHAZADA',
  datos: { aprobadoPor: number; compraId?: number; motivoRechazo?: string },
): void {
  db.prepare(
    `UPDATE solicitudes_compra
     SET estado = ?, compra_id = ?, aprobado_por = ?, aprobado_en = datetime('now'),
         motivo_rechazo = ?, actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(
    decision,
    datos.compraId ?? null,
    datos.aprobadoPor,
    decision === 'RECHAZADA' ? datos.motivoRechazo ?? null : null,
    id,
  );
}
