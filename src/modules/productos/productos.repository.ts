import { db } from '../../config/database';
import { calcularSemaforo, type Semaforo } from '../../shared/semaphore';

export interface ProductoRow {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  descripcion: string | null;
  precio_unitario: number;
  stock_real: number;
  stock_comprometido: number;
  stock_minimo: number;
  proveedor_id: number | null;
  descuento_porcentaje: number;
  costo_unitario: number;
  activo: number;
  creado_en: string;
  actualizado_en: string;
}

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  descripcion: string | null;
  precioUnitario: number;
  stockReal: number;
  stockComprometido: number;
  stockMinimo: number;
  proveedorId: number | null;
  descuentoPorcentaje: number;
  stockDisponible: number;
  semaforo: Semaforo;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CreateProductoData {
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida?: string;
  descripcion?: string;
  precioUnitario: number;
  stockReal: number;
  stockComprometido?: number;
  stockMinimo?: number;
  proveedorId?: number | null;
  descuentoPorcentaje?: number;
  activo: boolean;
}

export interface UpdateProductoData {
  codigo?: string;
  nombre?: string;
  categoria?: string;
  unidadMedida?: string;
  descripcion?: string;
  precioUnitario?: number;
  stockReal?: number;
  stockComprometido?: number;
  stockMinimo?: number;
  proveedorId?: number | null;
  descuentoPorcentaje?: number;
  activo?: boolean;
}

export interface ListProductosFilters {
  q?: string;
  categoria?: string;
  activo?: boolean;
  page: number;
  limit: number;
}

export function toProducto(row: ProductoRow): Producto {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadMedida: row.unidad_medida,
    descripcion: row.descripcion,
    precioUnitario: row.precio_unitario,
    stockReal: row.stock_real,
    stockComprometido: row.stock_comprometido,
    stockMinimo: row.stock_minimo,
    proveedorId: row.proveedor_id,
    descuentoPorcentaje: row.descuento_porcentaje,
    stockDisponible: row.stock_real - row.stock_comprometido,
    semaforo: calcularSemaforo(row.stock_real, row.stock_comprometido, row.stock_minimo),
    activo: row.activo === 1,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export function findProductoById(id: number): ProductoRow | undefined {
  return db.prepare('SELECT * FROM productos_epp WHERE id = ?').get(id) as ProductoRow | undefined;
}

export function findProductoByCodigo(codigo: string): ProductoRow | undefined {
  return db.prepare('SELECT * FROM productos_epp WHERE codigo = ?').get(codigo) as ProductoRow | undefined;
}

export function listProductos(filters: ListProductosFilters): { items: Producto[]; total: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push('(codigo LIKE ? OR nombre LIKE ? OR categoria LIKE ?)');
    params.push(like, like, like);
  }
  if (filters.categoria) {
    conditions.push('categoria = ?');
    params.push(filters.categoria);
  }
  if (filters.activo !== undefined) {
    conditions.push('activo = ?');
    params.push(filters.activo ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM productos_epp ${where}`).get(...params) as { total: number }
  ).total;
  const rows = db
    .prepare(`SELECT * FROM productos_epp ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as ProductoRow[];

  return { items: rows.map(toProducto), total };
}

export function listProductosActivos(): ProductoRow[] {
  return db.prepare('SELECT * FROM productos_epp WHERE activo = 1 ORDER BY categoria, nombre').all() as ProductoRow[];
}

export function listCategorias(): string[] {
  const rows = db
    .prepare('SELECT DISTINCT categoria FROM productos_epp ORDER BY categoria ASC')
    .all() as { categoria: string }[];
  return rows.map((row) => row.categoria);
}

export function createProducto(data: CreateProductoData): ProductoRow {
  const result = db
    .prepare(
       `INSERT INTO productos_epp
         (codigo, nombre, categoria, unidad_medida, descripcion, precio_unitario,
          stock_real, stock_comprometido, stock_minimo, proveedor_id, descuento_porcentaje, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.codigo,
      data.nombre,
      data.categoria,
      data.unidadMedida ?? 'UND',
      data.descripcion ?? null,
      data.precioUnitario,
      data.stockReal,
      data.stockComprometido ?? 0,
      data.stockMinimo ?? 0,
      data.proveedorId ?? null,
      data.descuentoPorcentaje ?? 0,
      data.activo ? 1 : 0,
    );
  return findProductoById(Number(result.lastInsertRowid))!;
}

export function updateProducto(id: number, data: UpdateProductoData): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  const fields: [Exclude<keyof UpdateProductoData, 'activo'>, string][] = [
    ['codigo', 'codigo'],
    ['nombre', 'nombre'],
    ['categoria', 'categoria'],
    ['unidadMedida', 'unidad_medida'],
    ['descripcion', 'descripcion'],
    ['precioUnitario', 'precio_unitario'],
    ['stockReal', 'stock_real'],
    ['stockComprometido', 'stock_comprometido'],
    ['stockMinimo', 'stock_minimo'],
    ['descuentoPorcentaje', 'descuento_porcentaje'],
  ];

  for (const [key, column] of fields) {
    const value = data[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (data.proveedorId !== undefined) {
    sets.push('proveedor_id = ?');
    params.push(data.proveedorId);
  }
  if (data.activo !== undefined) {
    sets.push('activo = ?');
    params.push(data.activo ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push("actualizado_en = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE productos_epp SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function deactivateProducto(id: number): void {
  db.prepare(`UPDATE productos_epp SET activo = 0, actualizado_en = datetime('now') WHERE id = ?`).run(id);
}
