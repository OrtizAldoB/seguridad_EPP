import { db } from '../../config/database';
import { DESCUENTO_MAXIMO_SIN_APROBACION } from '../../shared/constants';
import { liberarReserva as liberarReservaPedido } from '../pedidos/pedidos.repository';

export interface AuditoriaRow {
  id: number;
  pedido_id: number | null;
  cotizacion_id: number | null;
  usuario_aprobador_id: number;
  tipo_validacion: string;
  decision: string;
  observacion: string | null;
  fecha_hora: string;
  aprobador?: string;
  pedido_codigo?: string | null;
  cotizacion_codigo?: string | null;
}

export interface PendienteRow {
  id: number;
  codigo: string;
  cliente: string;
  total: number;
  descuento_porcentaje: number;
  condicion_pago: string;
  fecha: string;
  tipos: string[];
}

export function findCotizacionesParaAprobar(): PendienteRow[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.codigo, cl.razon_social AS cliente, c.total, c.descuento_porcentaje,
              c.condicion_pago, c.fecha_emision AS fecha
       FROM cotizaciones c JOIN clientes cl ON cl.id = c.cliente_id
       WHERE c.requiere_aprobacion = 1 AND c.estado IN ('ENVIADA','ACEPTADA')
         AND c.aprobada_en IS NULL
       ORDER BY c.id DESC`,
    )
    .all() as Omit<PendienteRow, 'tipos'>[];
  return rows.map((row) => ({ ...row, tipos: tiposDe(row.descuento_porcentaje, row.condicion_pago) }));
}

export function findPedidosParaAprobar(): PendienteRow[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.codigo, c.razon_social AS cliente, p.total, p.descuento_porcentaje,
              p.condicion_pago, p.creado_en AS fecha
       FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
       WHERE p.estado = 'PENDIENTE_APROBACION'
       ORDER BY p.id DESC`,
    )
    .all() as Omit<PendienteRow, 'tipos'>[];
  return rows.map((row) => ({ ...row, tipos: tiposDe(row.descuento_porcentaje, row.condicion_pago) }));
}

export function tiposDe(descuento: number, condicionPago: string): string[] {
  const tipos: string[] = [];
  if (descuento > DESCUENTO_MAXIMO_SIN_APROBACION) tipos.push('DESCUENTO_ESPECIAL');
  if (condicionPago === 'CREDITO') tipos.push('VENTA_CREDITO');
  return tipos.length ? tipos : ['DESCUENTO_ESPECIAL'];
}

export function findCotizacion(id: number): {
  id: number;
  descuento_porcentaje: number;
  condicion_pago: string;
  estado: string;
  aprobada_en: string | null;
} | undefined {
  return db
    .prepare('SELECT id, descuento_porcentaje, condicion_pago, estado, aprobada_en FROM cotizaciones WHERE id = ?')
    .get(id) as
    | { id: number; descuento_porcentaje: number; condicion_pago: string; estado: string; aprobada_en: string | null }
    | undefined;
}

export function findPedido(id: number): { id: number; descuento_porcentaje: number; condicion_pago: string; estado: string; codigo: string } | undefined {
  return db
    .prepare('SELECT id, descuento_porcentaje, condicion_pago, estado, codigo FROM pedidos WHERE id = ?')
    .get(id) as { id: number; descuento_porcentaje: number; condicion_pago: string; estado: string; codigo: string } | undefined;
}

export function insertAuditoria(data: {
  pedidoId: number | null;
  cotizacionId: number | null;
  usuarioId: number;
  tipo: string;
  decision: string;
  observacion: string | null;
}): void {
  db.prepare(
    `INSERT INTO auditoria_financiera
      (pedido_id, cotizacion_id, usuario_aprobador_id, tipo_validacion, decision, observacion)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(data.pedidoId, data.cotizacionId, data.usuarioId, data.tipo, data.decision, data.observacion);
}

export function setCotizacionEstado(id: number, estado: string): void {
  db.prepare(`UPDATE cotizaciones SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`).run(estado, id);
}

export function marcarCotizacionAprobada(id: number): void {
  db.prepare(`UPDATE cotizaciones SET aprobada_en = datetime('now'), actualizado_en = datetime('now') WHERE id = ?`).run(id);
}

export function setPedidoEstado(id: number, estado: string): void {
  db.prepare(`UPDATE pedidos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`).run(estado, id);
}

export function notifyAlmacen(pedidoId: number, mensaje: string): void {
  db.prepare('INSERT INTO notificaciones_almacen (pedido_id, mensaje) VALUES (?, ?)').run(pedidoId, mensaje);
}

export function liberarReserva(pedidoId: number, usuarioId?: number): void {
  liberarReservaPedido(pedidoId, usuarioId);
}

export function listHistorial(filters: { decision?: string; tipo?: string; page: number; limit: number }): {
  items: AuditoriaRow[];
  total: number;
} {
  const conditions: string[] = [];
  const params: string[] = [];
  if (filters.decision) {
    conditions.push('a.decision = ?');
    params.push(filters.decision);
  }
  if (filters.tipo) {
    conditions.push('a.tipo_validacion = ?');
    params.push(filters.tipo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS total FROM auditoria_financiera a ${where}`).get(...params) as { total: number }).total;
  const items = db
    .prepare(
      `SELECT a.*, u.nombre_completo AS aprobador, p.codigo AS pedido_codigo, c.codigo AS cotizacion_codigo
       FROM auditoria_financiera a
       JOIN usuarios u ON u.id = a.usuario_aprobador_id
       LEFT JOIN pedidos p ON p.id = a.pedido_id
       LEFT JOIN cotizaciones c ON c.id = a.cotizacion_id
       ${where}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as AuditoriaRow[];
  return { items, total };
}
