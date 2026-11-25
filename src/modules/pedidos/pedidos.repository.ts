import { db } from '../../config/database';
import { ConflictError } from '../../shared/errors';
import { registrarMovimientoReserva } from '../reservas/reservas.repository';

export interface PedidoRow {
  id: number;
  codigo: string;
  cotizacion_id: number | null;
  cliente_id: number;
  vendedor_id: number;
  estado: string;
  condicion_pago: string;
  descuento_porcentaje: number;
  subtotal: number;
  descuento_monto: number;
  impuesto_monto: number;
  interes_monto: number;
  plazo_meses: number;
  fecha_limite_pago: string | null;
  total: number;
  fecha_estimada_entrega: string;
  creado_en: string;
  actualizado_en: string;
  despachado_por: number | null;
  despachado_en: string | null;
  observacion: string | null;
  razon_social?: string;
  nit_ci?: string;
  nombre_completo?: string;
}

export interface PedidoDetalleRow {
  id: number;
  pedido_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  categoria: string;
}

export interface ListPedidosFilters {
  estado?: string;
  cliente_id?: number;
  vendedor_id?: number;
  q?: string;
  page: number;
  limit: number;
}

const BASE_SELECT = `
  SELECT p.*, c.razon_social, c.nit_ci, u.nombre_completo
  FROM pedidos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN usuarios u ON u.id = p.vendedor_id
`;

export function findPedidoById(id: number): PedidoRow | undefined {
  return db.prepare(`${BASE_SELECT} WHERE p.id = ?`).get(id) as PedidoRow | undefined;
}

export function findPedidoByCodigo(codigo: string): PedidoRow | undefined {
  return db.prepare(`${BASE_SELECT} WHERE p.codigo = ?`).get(codigo) as PedidoRow | undefined;
}

export function listPedidos(filters: ListPedidosFilters): { items: PedidoRow[]; total: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.estado) {
    conditions.push('p.estado = ?');
    params.push(filters.estado);
  }
  if (filters.cliente_id) {
    conditions.push('p.cliente_id = ?');
    params.push(filters.cliente_id);
  }
  if (filters.vendedor_id) {
    conditions.push('p.vendedor_id = ?');
    params.push(filters.vendedor_id);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push('(p.codigo LIKE ? OR c.razon_social LIKE ? OR c.nit_ci LIKE ?)');
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ${where}`).get(...params) as {
      total: number;
    }
  ).total;
  const items = db
    .prepare(`${BASE_SELECT} ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as PedidoRow[];

  return { items, total };
}

export function nextCodigo(prefix: string, table: 'pedidos' | 'cotizaciones'): string {
  const row = db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM ${table}`).get() as { n: number };
  const now = new Date();
  const fecha = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `${prefix}-${fecha}-${String(row.n).padStart(4, '0')}`;
}

export function findDetallesByPedidoId(pedidoId: number): PedidoDetalleRow[] {
  return db
    .prepare(
      `SELECT d.*, p.codigo, p.nombre, p.unidad_medida, p.categoria
       FROM pedido_detalles d JOIN productos_epp p ON p.id = d.producto_id
       WHERE d.pedido_id = ? ORDER BY p.codigo`,
    )
    .all(pedidoId) as PedidoDetalleRow[];
}

export function insertPedido(data: {
  codigo: string;
  cotizacionId: number | null;
  clienteId: number;
  vendedorId: number;
  estado: string;
  condicionPago: string;
  descuentoPorcentaje: number;
  subtotal: number;
  descuentoMonto: number;
  impuestoMonto: number;
  interesMonto: number;
  plazoMeses: number;
  fechaLimitePago: string | null;
  total: number;
  fechaEstimadaEntrega: string;
  observacion: string | null;
}): number {
  const result = db
    .prepare(
       `INSERT INTO pedidos
         (codigo, cotizacion_id, cliente_id, vendedor_id, estado, condicion_pago, descuento_porcentaje,
          subtotal, descuento_monto, impuesto_monto, interes_monto, plazo_meses, fecha_limite_pago,
          total, fecha_estimada_entrega, observacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.codigo,
      data.cotizacionId,
      data.clienteId,
      data.vendedorId,
      data.estado,
      data.condicionPago,
      data.descuentoPorcentaje,
      data.subtotal,
      data.descuentoMonto,
      data.impuestoMonto,
      data.interesMonto,
      data.plazoMeses,
      data.fechaLimitePago,
      data.total,
      data.fechaEstimadaEntrega,
      data.observacion,
    );
  return Number(result.lastInsertRowid);
}

export function insertPedidoDetalle(pedidoId: number, productoId: number, cantidad: number, precio: number, subtotal: number): void {
  db.prepare(
    `INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(pedidoId, productoId, cantidad, precio, subtotal);
}

export function updateEstado(id: number, estado: string, despachadoPor?: number): void {
  if (despachadoPor !== undefined) {
    db.prepare(
      `UPDATE pedidos SET estado = ?, despachado_por = ?, despachado_en = datetime('now'), actualizado_en = datetime('now') WHERE id = ?`,
    ).run(estado, despachadoPor, id);
    return;
  }
  db.prepare(`UPDATE pedidos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?`).run(estado, id);
}

export function notifyAlmacen(pedidoId: number, mensaje: string): void {
  db.prepare('INSERT INTO notificaciones_almacen (pedido_id, mensaje) VALUES (?, ?)').run(pedidoId, mensaje);
}

export function findProductoParaReserva(id: number): {
  id: number;
  codigo: string;
  nombre: string;
  activo: number;
  precio_unitario: number;
  stock_real: number;
  stock_comprometido: number;
} | undefined {
  return db
    .prepare(
      `SELECT id, codigo, nombre, activo, precio_unitario, stock_real, stock_comprometido FROM productos_epp WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        codigo: string;
        nombre: string;
        activo: number;
        precio_unitario: number;
        stock_real: number;
        stock_comprometido: number;
      }
    | undefined;
}

export function reservarStock(
  productoId: number,
  cantidad: number,
  codigo: string,
  pedidoId: number,
  usuarioId?: number,
): void {
  const result = db
    .prepare(
      `UPDATE productos_epp
       SET stock_comprometido = stock_comprometido + ?, actualizado_en = datetime('now')
       WHERE id = ? AND activo = 1 AND stock_real - stock_comprometido >= ?`,
    )
    .run(cantidad, productoId, cantidad);
  if (result.changes !== 1) {
    throw new ConflictError(`Stock insuficiente para ${codigo}`);
  }
  registrarMovimientoReserva({ productoId, pedidoId, tipo: 'RESERVA', cantidad, usuarioId });
}

export function liberarReserva(pedidoId: number, usuarioId?: number): void {
  const detalles = db
    .prepare(
      `SELECT d.producto_id, d.cantidad, p.codigo
       FROM pedido_detalles d JOIN productos_epp p ON p.id = d.producto_id
       WHERE d.pedido_id = ?`,
    )
    .all(pedidoId) as { producto_id: number; cantidad: number; codigo: string }[];
  for (const detalle of detalles) {
    const result = db
      .prepare(
        `UPDATE productos_epp
         SET stock_comprometido = stock_comprometido - ?, actualizado_en = datetime('now')
         WHERE id = ? AND stock_comprometido >= ?`,
      )
      .run(detalle.cantidad, detalle.producto_id, detalle.cantidad);
    if (result.changes !== 1) throw new ConflictError(`No se puede liberar la reserva de ${detalle.codigo}`);
    registrarMovimientoReserva({
      productoId: detalle.producto_id,
      pedidoId,
      tipo: 'LIBERACION',
      cantidad: detalle.cantidad,
      usuarioId,
    });
  }
}
