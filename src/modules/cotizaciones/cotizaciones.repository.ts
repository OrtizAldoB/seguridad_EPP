import { db } from '../../config/database';

export interface CotizacionRow {
  id: number;
  codigo: string;
  cliente_id: number;
  vendedor_id: number;
  subtotal: number;
  descuento_porcentaje: number;
  descuento_monto: number;
  impuesto_monto: number;
  total: number;
  plazo_meses: number;
  interes_monto: number;
  fecha_limite_pago: string | null;
  condicion_pago: string;
  requiere_aprobacion: number;
  aprobada_en: string | null;
  estado: string;
  observacion: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  creado_en: string;
  actualizado_en: string;
  razon_social?: string;
  nit_ci?: string;
  nombre_completo?: string;
}

export interface CotizacionDetalleRow {
  id: number;
  cotizacion_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal: number;
  codigo?: string;
  nombre?: string;
  unidad_medida?: string;
}

export interface ListCotizacionesFilters {
  q?: string;
  cliente_id?: number;
  estado?: string;
  soloVigentes?: boolean;
  page: number;
  limit: number;
}

const BASE_SELECT = `
  SELECT c.*, cl.razon_social, cl.nit_ci, u.nombre_completo
  FROM cotizaciones c
  JOIN clientes cl ON cl.id = c.cliente_id
  JOIN usuarios u ON u.id = c.vendedor_id
`;

export function expireCotizaciones(): void {
  db.prepare(
    `UPDATE cotizaciones
     SET estado = 'VENCIDA', actualizado_en = datetime('now')
     WHERE fecha_vencimiento < date('now') AND estado IN ('BORRADOR','ENVIADA','ACEPTADA')`,
  ).run();
}

export function findCotizacionById(id: number): CotizacionRow | undefined {
  return db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id) as CotizacionRow | undefined;
}

export function listCotizaciones(filters: ListCotizacionesFilters): { items: CotizacionRow[]; total: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push('(c.codigo LIKE ? OR cl.razon_social LIKE ? OR cl.nit_ci LIKE ?)');
    params.push(like, like, like);
  }
  if (filters.cliente_id) {
    conditions.push('c.cliente_id = ?');
    params.push(filters.cliente_id);
  }
  if (filters.estado) {
    conditions.push('c.estado = ?');
    params.push(filters.estado);
  }
  if (filters.soloVigentes) {
    conditions.push("c.estado NOT IN ('VENCIDA','CONVERTIDA','RECHAZADA') AND c.fecha_vencimiento >= date('now')");
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM cotizaciones c JOIN clientes cl ON cl.id = c.cliente_id ${where}`).get(...params) as {
      total: number;
    }
  ).total;
  const items = db
    .prepare(`${BASE_SELECT} ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as CotizacionRow[];

  return { items, total };
}

export function findDetallesByCotizacionId(cotizacionId: number): CotizacionDetalleRow[] {
  return db
    .prepare(
      `SELECT d.*, p.codigo, p.nombre, p.unidad_medida
       FROM cotizacion_detalles d JOIN productos_epp p ON p.id = d.producto_id
       WHERE d.cotizacion_id = ? ORDER BY p.codigo`,
    )
    .all(cotizacionId) as CotizacionDetalleRow[];
}

export function findProductoDisponible(id: number): {
  id: number;
  codigo: string;
  activo: number;
  precio_unitario: number;
  stock_real: number;
  stock_comprometido: number;
} | undefined {
  return db
    .prepare('SELECT id, codigo, activo, precio_unitario, stock_real, stock_comprometido FROM productos_epp WHERE id = ?')
    .get(id) as
    | { id: number; codigo: string; activo: number; precio_unitario: number; stock_real: number; stock_comprometido: number }
    | undefined;
}

export function nextCodigo(): string {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM cotizaciones').get() as { n: number };
  const now = new Date();
  const fecha = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `COT-${fecha}-${String(row.n).padStart(4, '0')}`;
}

export function insertCotizacion(data: {
  codigo: string;
  clienteId: number;
  vendedorId: number;
  subtotal: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  impuestoMonto: number;
  total: number;
  plazoMeses: number;
  interesMonto: number;
  fechaLimitePago: string | null;
  condicionPago: string;
  requiereAprobacion: number;
  estado: string;
  observacion: string | null;
  fechaVencimiento: string;
}): number {
  const result = db
    .prepare(
       `INSERT INTO cotizaciones
         (codigo, cliente_id, vendedor_id, subtotal, descuento_porcentaje, descuento_monto,
          impuesto_monto, total, plazo_meses, interes_monto, fecha_limite_pago,
          condicion_pago, requiere_aprobacion, estado, observacion, fecha_vencimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.codigo,
      data.clienteId,
      data.vendedorId,
      data.subtotal,
      data.descuentoPorcentaje,
      data.descuentoMonto,
      data.impuestoMonto,
      data.total,
      data.plazoMeses,
      data.interesMonto,
      data.fechaLimitePago,
      data.condicionPago,
      data.requiereAprobacion,
      data.estado,
      data.observacion,
      data.fechaVencimiento,
    );
  return Number(result.lastInsertRowid);
}

export function insertDetalle(data: {
  cotizacionId: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje: number;
  subtotal: number;
}): void {
  db.prepare(
    `INSERT INTO cotizacion_detalles
      (cotizacion_id, producto_id, cantidad, precio_unitario, descuento_porcentaje, subtotal)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    data.cotizacionId,
    data.productoId,
    data.cantidad,
    data.precioUnitario,
    data.descuentoPorcentaje,
    data.subtotal,
  );
}

export function replaceDetalles(cotizacionId: number): void {
  db.prepare('DELETE FROM cotizacion_detalles WHERE cotizacion_id = ?').run(cotizacionId);
}

export function updateCotizacion(id: number, data: {
  subtotal: number;
  descuentoPorcentaje: number;
  descuentoMonto: number;
  impuestoMonto: number;
  total: number;
  plazoMeses: number;
  interesMonto: number;
  fechaLimitePago: string | null;
  condicionPago: string;
  requiereAprobacion: number;
  observacion: string | null;
}): void {
  db.prepare(
    `UPDATE cotizaciones SET subtotal=?, descuento_porcentaje=?, descuento_monto=?, impuesto_monto=?,
       total=?, plazo_meses=?, interes_monto=?, fecha_limite_pago=?,
       condicion_pago=?, requiere_aprobacion=?, observacion=?, aprobada_en=NULL,
       actualizado_en=datetime('now')
      WHERE id=?`,
  ).run(
    data.subtotal,
    data.descuentoPorcentaje,
    data.descuentoMonto,
    data.impuestoMonto,
    data.total,
    data.plazoMeses,
    data.interesMonto,
    data.fechaLimitePago,
    data.condicionPago,
    data.requiereAprobacion,
    data.observacion,
    id,
  );
}

export function setEstado(id: number, estado: string): void {
  db.prepare(`UPDATE cotizaciones SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`).run(estado, id);
}

export function ultimaDecision(cotizacionId: number): string | undefined {
  const row = db
    .prepare(
      `SELECT decision FROM auditoria_financiera WHERE cotizacion_id = ? ORDER BY fecha_hora DESC, id DESC LIMIT 1`,
    )
    .get(cotizacionId) as { decision: string } | undefined;
  return row?.decision;
}
