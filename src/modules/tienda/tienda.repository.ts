import { db } from '../../config/database';
import { round2 } from '../../shared/pricing';
import { findDetallesByPedidoId, type PedidoDetalleRow, type PedidoRow } from '../pedidos/pedidos.repository';
import { listCategorias, toProducto, type Producto, type ProductoRow } from '../productos/productos.repository';

export interface CarritoItemRow {
  usuario_id: number;
  producto_id: number;
  cantidad: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  descripcion: string | null;
  precio_unitario: number;
  stock_real: number;
  stock_comprometido: number;
  stock_minimo: number;
  activo: number;
}

export interface CarritoItem {
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  descripcion: string | null;
  precioUnitario: number;
  stockDisponible: number;
  cantidad: number;
  subtotal: number;
}

export interface PedidoPropio {
  pedido: PedidoRow;
  items: PedidoDetalleRow[];
}

const CARRITO_SELECT = `
  SELECT c.usuario_id, c.producto_id, c.cantidad, p.codigo, p.nombre, p.categoria,
         p.unidad_medida, p.descripcion, p.precio_unitario, p.stock_real,
         p.stock_comprometido, p.stock_minimo, p.activo
  FROM carrito_items c JOIN productos_epp p ON p.id = c.producto_id
`;

export function toCarritoItem(row: CarritoItemRow): CarritoItem {
  return {
    productoId: row.producto_id,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadMedida: row.unidad_medida,
    descripcion: row.descripcion,
    precioUnitario: row.precio_unitario,
    stockDisponible: row.stock_real - row.stock_comprometido,
    cantidad: row.cantidad,
    subtotal: round2(row.cantidad * row.precio_unitario),
  };
}

export function listCatalogo(q?: string, categoria?: string): Producto[] {
  const conditions = ['activo = 1'];
  const params: string[] = [];
  if (q) {
    conditions.push('(codigo LIKE ? OR nombre LIKE ? OR categoria LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (categoria) {
    conditions.push('categoria = ?');
    params.push(categoria);
  }
  const rows = db
    .prepare(`SELECT * FROM productos_epp WHERE ${conditions.join(' AND ')} ORDER BY categoria, nombre`)
    .all(...params) as ProductoRow[];
  return rows.map(toProducto);
}

export function catalogoCategorias(): string[] {
  return listCategorias();
}

export function listCarrito(usuarioId: number): CarritoItemRow[] {
  return db
    .prepare(`${CARRITO_SELECT} WHERE c.usuario_id = ? ORDER BY p.categoria, p.nombre`)
    .all(usuarioId) as CarritoItemRow[];
}

export function findCantidad(usuarioId: number, productoId: number): number {
  const row = db
    .prepare('SELECT cantidad FROM carrito_items WHERE usuario_id = ? AND producto_id = ?')
    .get(usuarioId, productoId) as { cantidad: number } | undefined;
  return row?.cantidad ?? 0;
}

export function upsertItem(usuarioId: number, productoId: number, cantidad: number): void {
  db.prepare(
    `INSERT INTO carrito_items (usuario_id, producto_id, cantidad) VALUES (?, ?, ?)
     ON CONFLICT(usuario_id, producto_id) DO UPDATE SET
       cantidad = carrito_items.cantidad + excluded.cantidad,
       actualizado_en = datetime('now')`,
  ).run(usuarioId, productoId, cantidad);
}

export function setCantidad(usuarioId: number, productoId: number, cantidad: number): void {
  db.prepare(
    `UPDATE carrito_items SET cantidad = ?, actualizado_en = datetime('now')
     WHERE usuario_id = ? AND producto_id = ?`,
  ).run(cantidad, usuarioId, productoId);
}

export function removeItem(usuarioId: number, productoId: number): void {
  db.prepare('DELETE FROM carrito_items WHERE usuario_id = ? AND producto_id = ?').run(usuarioId, productoId);
}

export function clearCarrito(usuarioId: number): void {
  db.prepare('DELETE FROM carrito_items WHERE usuario_id = ?').run(usuarioId);
}

export function listMisPedidos(clienteId: number): PedidoPropio[] {
  const rows = db
    .prepare(
      `SELECT p.*, c.razon_social, c.nit_ci, u.nombre_completo
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       WHERE p.cliente_id = ? ORDER BY p.id DESC LIMIT 50`,
    )
    .all(clienteId) as PedidoRow[];
  return rows.map((pedido) => ({ pedido, items: findDetallesByPedidoId(pedido.id) }));
}

export function findPedidoPropio(id: number, clienteId: number): PedidoPropio | undefined {
  const row = db
    .prepare(
      `SELECT p.*, c.razon_social, c.nit_ci, u.nombre_completo
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       WHERE p.id = ? AND p.cliente_id = ?`,
    )
    .get(id, clienteId) as PedidoRow | undefined;
  if (!row) return undefined;
  return { pedido: row, items: findDetallesByPedidoId(row.id) };
}
