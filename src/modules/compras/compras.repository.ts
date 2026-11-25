import { db } from '../../config/database';
import type { EstadoCompra } from './compras.schema';

export interface CompraRow {
  id: number; codigo: string; proveedor_id: number; usuario_id: number; estado: EstadoCompra; observacion: string | null;
  total: number; fecha_emision: string; fecha_recepcion: string | null; creado_en: string; actualizado_en: string;
  proveedor_razon_social: string; proveedor_nit_ci: string; usuario_nombre_completo: string;
}
export interface CompraDetalleRow { id: number; compra_id: number; producto_id: number; cantidad: number; costo_unitario: number; subtotal: number; producto_codigo: string; producto_nombre: string; }
export interface Compra { id: number; codigo: string; proveedorId: number; proveedorRazonSocial: string; proveedorNitCi: string; usuarioId: number; usuarioNombreCompleto: string; estado: EstadoCompra; observacion: string | null; total: number; fechaEmision: string; fechaRecepcion: string | null; creadoEn: string; actualizadoEn: string; }
export interface CompraDetalle { id: number; compraId: number; productoId: number; productoCodigo: string; productoNombre: string; cantidad: number; costoUnitario: number; subtotal: number; }

export function toCompra(r: CompraRow): Compra {
  return { id: r.id, codigo: r.codigo, proveedorId: r.proveedor_id, proveedorRazonSocial: r.proveedor_razon_social, proveedorNitCi: r.proveedor_nit_ci, usuarioId: r.usuario_id, usuarioNombreCompleto: r.usuario_nombre_completo, estado: r.estado, observacion: r.observacion, total: r.total, fechaEmision: r.fecha_emision, fechaRecepcion: r.fecha_recepcion, creadoEn: r.creado_en, actualizadoEn: r.actualizado_en };
}
export function toDetalle(r: CompraDetalleRow): CompraDetalle { return { id: r.id, compraId: r.compra_id, productoId: r.producto_id, productoCodigo: r.producto_codigo, productoNombre: r.producto_nombre, cantidad: r.cantidad, costoUnitario: r.costo_unitario, subtotal: r.subtotal }; }

const BASE = `SELECT c.*, p.razon_social AS proveedor_razon_social, p.nit_ci AS proveedor_nit_ci, u.nombre_completo AS usuario_nombre_completo
  FROM compras c JOIN proveedores p ON p.id = c.proveedor_id JOIN usuarios u ON u.id = c.usuario_id`;

export function findCompraById(id: number) { return db.prepare(`${BASE} WHERE c.id = ?`).get(id) as CompraRow | undefined; }
export function listDetalles(compraId: number) { return (db.prepare(`SELECT d.*, pr.codigo AS producto_codigo, pr.nombre AS producto_nombre FROM compra_detalles d JOIN productos_epp pr ON pr.id = d.producto_id WHERE d.compra_id = ? ORDER BY d.id`).all(compraId) as CompraDetalleRow[]).map(toDetalle); }

export function listCompras(f: { q?: string; estado?: EstadoCompra; proveedor_id?: number; page: number; limit: number }) {
  const cond: string[] = []; const params: (string | number)[] = [];
  if (f.q) { const like = `%${f.q}%`; cond.push('(c.codigo LIKE ? OR p.razon_social LIKE ? OR p.nit_ci LIKE ?)'); params.push(like, like, like); }
  if (f.estado) { cond.push('c.estado = ?'); params.push(f.estado); }
  if (f.proveedor_id) { cond.push('c.proveedor_id = ?'); params.push(f.proveedor_id); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS total FROM compras c JOIN proveedores p ON p.id=c.proveedor_id ${where}`).get(...params) as { total: number }).total;
  const rows = db.prepare(`${BASE} ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`).all(...params, f.limit, (f.page - 1) * f.limit) as CompraRow[];
  return { items: rows.map(toCompra), total };
}

export function findProveedorActivo(id: number) { return db.prepare("SELECT id, razon_social, nit_ci, estado FROM proveedores WHERE id = ?").get(id) as { id: number; razon_social: string; nit_ci: string; estado: string } | undefined; }
export function findProducto(id: number) { return db.prepare('SELECT id, codigo, nombre, stock_real, stock_comprometido, precio_unitario, costo_unitario FROM productos_epp WHERE id = ?').get(id) as { id: number; codigo: string; nombre: string; stock_real: number; stock_comprometido: number; precio_unitario: number; costo_unitario: number } | undefined; }

export function nextCodigo(): string {
  const row = db.prepare("SELECT COUNT(*) AS n FROM compras WHERE date(creado_en)=date('now')").get() as { n: number };
  const d = new Date(); const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `COM-${ymd}-${String(row.n + 1).padStart(4, '0')}`;
}

export function createCompra(data: { codigo: string; proveedorId: number; usuarioId: number; observacion?: string; fechaEmision: string; total: number }) {
  const r = db.prepare(`INSERT INTO compras (codigo, proveedor_id, usuario_id, estado, observacion, total, fecha_emision) VALUES (?, ?, ?, 'REGISTRADA', ?, ?, ?)`)
    .run(data.codigo, data.proveedorId, data.usuarioId, data.observacion ?? null, data.total, data.fechaEmision);
  return Number(r.lastInsertRowid);
}
export function insertDetalle(d: { compraId: number; productoId: number; cantidad: number; costoUnitario: number; subtotal: number }) {
  db.prepare(`INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES (?, ?, ?, ?, ?)`).run(d.compraId, d.productoId, d.cantidad, d.costoUnitario, d.subtotal);
}
export function updateCompraEstado(id: number, estado: EstadoCompra, fechaRecepcion: string | null) {
  db.prepare(`UPDATE compras SET estado = ?, fecha_recepcion = ?, actualizado_en = datetime('now') WHERE id = ?`).run(estado, fechaRecepcion, id);
}
export function stockProducto(id: number) { return db.prepare('SELECT stock_real, stock_comprometido FROM productos_epp WHERE id = ?').get(id) as { stock_real: number; stock_comprometido: number } | undefined; }
export function aplicarEntradaStock(productoId: number, cantidad: number, stockAnterior: number) {
  db.prepare(`UPDATE productos_epp SET stock_real = stock_real + ?, actualizado_en = datetime('now') WHERE id = ? AND stock_real = ?`).run(cantidad, productoId, stockAnterior);
}
export function insertKardex(d: { productoId: number; cantidad: number; stockAnterior: number; stockNuevo: number; referencia: string; observacion?: string; usuarioId: number; costoUnitario: number }) {
  const valorTotal = Number((d.cantidad * d.costoUnitario).toFixed(2));
  db.prepare(`INSERT INTO kardex_movimientos
    (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, observacion,
     usuario_id, costo_unitario, valor_total, verificado_por, verificado_en)
    VALUES (?, 'ENTRADA_COMPRA', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(d.productoId, d.cantidad, d.stockAnterior, d.stockNuevo, d.referencia, d.observacion ?? null,
      d.usuarioId, d.costoUnitario, valorTotal, d.usuarioId);
}
