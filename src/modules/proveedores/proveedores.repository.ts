import { db } from '../../config/database';
import type { EstadoProveedor } from './proveedores.schema';

export interface ProveedorRow {
  id: number; razon_social: string; nit_ci: string; telefono: string | null; email: string | null;
  direccion: string | null; contacto: string | null; estado: EstadoProveedor; creado_en: string; actualizado_en: string;
}
export interface Proveedor {
  id: number; razonSocial: string; nitCi: string; telefono: string | null; email: string | null;
  direccion: string | null; contacto: string | null; estado: EstadoProveedor; creadoEn: string; actualizadoEn: string;
}
export interface CreateProveedorData { razonSocial: string; nitCi: string; telefono?: string; email?: string; direccion?: string; contacto?: string; estado: EstadoProveedor; }
export interface UpdateProveedorData { razonSocial?: string; nitCi?: string; telefono?: string; email?: string; direccion?: string; contacto?: string; estado?: EstadoProveedor; }
export interface ListProveedoresFilters { q?: string; estado?: EstadoProveedor; page: number; limit: number; }
export interface ProductoNuevoData {
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida?: string;
  descripcion?: string;
}
export interface CreateProveedorProductoData {
  productoId?: number;
  productoNuevo?: ProductoNuevoData;
  precioUnitario: number;
  minimoCompra: number;
}
export interface ProveedorProducto {
  productoId: number;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  precioUnitario: number;
  minimoCompra: number;
  stockDisponible: number;
}

export function toProveedor(r: ProveedorRow): Proveedor {
  return { id: r.id, razonSocial: r.razon_social, nitCi: r.nit_ci, telefono: r.telefono, email: r.email, direccion: r.direccion, contacto: r.contacto, estado: r.estado, creadoEn: r.creado_en, actualizadoEn: r.actualizado_en };
}
export function findProveedorById(id: number) { return db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id) as ProveedorRow | undefined; }
export function findProveedorByNitCi(nitCi: string) { return db.prepare('SELECT * FROM proveedores WHERE nit_ci = ? COLLATE NOCASE').get(nitCi) as ProveedorRow | undefined; }

export function listProveedores(f: ListProveedoresFilters): { items: Proveedor[]; total: number } {
  const cond: string[] = []; const params: (string | number)[] = [];
  if (f.q) { const like = `%${f.q}%`; cond.push('(razon_social LIKE ? OR nit_ci LIKE ? OR contacto LIKE ? OR email LIKE ?)'); params.push(like, like, like, like); }
  if (f.estado) { cond.push('estado = ?'); params.push(f.estado); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS total FROM proveedores ${where}`).get(...params) as { total: number }).total;
  const rows = db.prepare(`SELECT * FROM proveedores ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, f.limit, (f.page - 1) * f.limit) as ProveedorRow[];
  return { items: rows.map(toProveedor), total };
}

export function createProveedor(d: CreateProveedorData): ProveedorRow {
  const r = db.prepare(`INSERT INTO proveedores (razon_social, nit_ci, telefono, email, direccion, contacto, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(d.razonSocial, d.nitCi, d.telefono ?? null, d.email ?? null, d.direccion ?? null, d.contacto ?? null, d.estado);
  return findProveedorById(Number(r.lastInsertRowid))!;
}
export function updateProveedor(id: number, d: UpdateProveedorData): void {
  const sets: string[] = []; const params: (string | number)[] = [];
  const map: [keyof UpdateProveedorData, string][] = [['razonSocial','razon_social'],['nitCi','nit_ci'],['telefono','telefono'],['email','email'],['direccion','direccion'],['contacto','contacto'],['estado','estado']];
  for (const [k, col] of map) { const v = d[k]; if (v !== undefined) { sets.push(`${col} = ?`); params.push(v); } }
  if (!sets.length) return;
  sets.push("actualizado_en = datetime('now')"); params.push(id);
  db.prepare(`UPDATE proveedores SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}
export function deactivateProveedor(id: number): void {
  db.prepare(`UPDATE proveedores SET estado = 'INACTIVO', actualizado_en = datetime('now') WHERE id = ?`).run(id);
}

export function findProductoBase(id: number): { id: number; codigo: string } | undefined {
  return db.prepare('SELECT id, codigo FROM productos_epp WHERE id = ?').get(id) as { id: number; codigo: string } | undefined;
}

export function findOfertaProveedor(proveedorId: number, productoId: number): { minimoCompra: number; precioUnitario: number } | undefined {
  return db
    .prepare('SELECT minimo_compra AS minimoCompra, precio_unitario AS precioUnitario FROM proveedor_productos WHERE proveedor_id = ? AND producto_id = ?')
    .get(proveedorId, productoId) as { minimoCompra: number; precioUnitario: number } | undefined;
}

export function proveedorTieneOfertas(proveedorId: number): boolean {
  const row = db.prepare('SELECT 1 AS existe FROM proveedor_productos WHERE proveedor_id = ? LIMIT 1').get(proveedorId) as { existe: number } | undefined;
  return Boolean(row);
}

export function listOfertasByProveedorId(proveedorId: number): ProveedorProducto[] {
  const rows = db
    .prepare(
       `SELECT pp.producto_id, pp.precio_unitario, pp.minimo_compra,
               p.codigo, p.nombre, p.unidad_medida, p.stock_real - p.stock_comprometido AS stock_disponible
       FROM proveedor_productos pp
       JOIN productos_epp p ON p.id = pp.producto_id
       WHERE pp.proveedor_id = ?
       ORDER BY p.codigo`,
    )
    .all(proveedorId) as {
      producto_id: number; precio_unitario: number; minimo_compra: number;
      codigo: string; nombre: string; unidad_medida: string; stock_disponible: number;
    }[];
  return rows.map((row) => ({
    productoId: row.producto_id,
    codigo: row.codigo,
    nombre: row.nombre,
    unidadMedida: row.unidad_medida,
    precioUnitario: row.precio_unitario,
    minimoCompra: row.minimo_compra,
    stockDisponible: row.stock_disponible,
  }));
}

export function replaceOfertas(proveedorId: number, productos: CreateProveedorProductoData[]): void {
  db.prepare('UPDATE productos_epp SET proveedor_id = NULL WHERE proveedor_id = ?').run(proveedorId);
  db.prepare('DELETE FROM proveedor_productos WHERE proveedor_id = ?').run(proveedorId);
  const insert = db.prepare(
    `INSERT INTO proveedor_productos (proveedor_id, producto_id, precio_unitario, minimo_compra)
     VALUES (?, ?, ?, ?)`,
  );
  const updateProducto = db.prepare(
    `UPDATE productos_epp
     SET proveedor_id = ?, costo_unitario = ?, actualizado_en = datetime('now')
     WHERE id = ?`,
  );
  for (const producto of productos) {
    if (!producto.productoId) throw new Error('Producto no resuelto al guardar ofertas');
    insert.run(proveedorId, producto.productoId, producto.precioUnitario, producto.minimoCompra);
    updateProducto.run(proveedorId, producto.precioUnitario, producto.productoId);
  }
}
