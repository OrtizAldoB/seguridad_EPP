import { db } from '../../config/database';
import { calcularSemaforo, type Semaforo } from '../../shared/semaphore';
import type { TipoMovimiento } from './inventario.schema';

export interface KardexRow {
  id: number;
  producto_id: number;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  costo_unitario: number;
  valor_total: number;
  verificado_por: number | null;
  verificado_en: string | null;
  verificado_por_nombre_completo: string | null;
  referencia: string | null;
  observacion: string | null;
  usuario_id: number;
  fecha: string;
  producto_codigo: string;
  producto_nombre: string;
  usuario_nombre_completo: string;
}

export interface KardexItem {
  id: number;
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  tipoMovimiento: TipoMovimiento;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  costoUnitario: number;
  valorTotal: number;
  verificadoPor: number | null;
  verificadoEn: string | null;
  verificadoPorNombreCompleto: string | null;
  referencia: string | null;
  observacion: string | null;
  usuarioId: number;
  usuarioNombreCompleto: string;
  fecha: string;
}

export interface ProductoStockRow {
  id: number;
  codigo: string;
  nombre: string;
  stock_real: number;
  stock_comprometido: number;
  activo: number;
}

export interface ProductoDisponibilidadRow {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  stock_real: number;
  stock_comprometido: number;
  stock_minimo: number;
}

export interface Disponibilidad {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  stockReal: number;
  stockComprometido: number;
  stockDisponible: number;
  stockMinimo: number;
  semaforo: Semaforo;
}

export interface ListKardexFilters {
  productoId?: number;
  tipoMovimiento?: TipoMovimiento;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  limit: number;
}

export interface CreateMovimientoData {
  productoId: number;
  tipoMovimiento: TipoMovimiento;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  referencia?: string;
  observacion?: string;
  usuarioId: number;
  costoUnitario?: number;
}

const KARDEX_SELECT = `
  SELECT k.id, k.producto_id, k.tipo_movimiento, k.cantidad, k.stock_anterior, k.stock_nuevo,
          k.costo_unitario, k.valor_total, k.verificado_por, k.verificado_en,
          v.nombre_completo AS verificado_por_nombre_completo,
          k.referencia, k.observacion, k.usuario_id, k.fecha,
          p.codigo AS producto_codigo, p.nombre AS producto_nombre,
          u.nombre_completo AS usuario_nombre_completo
  FROM kardex_movimientos k
  JOIN productos_epp p ON p.id = k.producto_id
  JOIN usuarios u ON u.id = k.usuario_id
  LEFT JOIN usuarios v ON v.id = k.verificado_por
`;

export function toKardexItem(row: KardexRow): KardexItem {
  return {
    id: row.id,
    productoId: row.producto_id,
    productoCodigo: row.producto_codigo,
    productoNombre: row.producto_nombre,
    tipoMovimiento: row.tipo_movimiento,
    cantidad: row.cantidad,
    stockAnterior: row.stock_anterior,
    stockNuevo: row.stock_nuevo,
    costoUnitario: row.costo_unitario,
    valorTotal: row.valor_total,
    verificadoPor: row.verificado_por,
    verificadoEn: row.verificado_en,
    verificadoPorNombreCompleto: row.verificado_por_nombre_completo,
    referencia: row.referencia,
    observacion: row.observacion,
    usuarioId: row.usuario_id,
    usuarioNombreCompleto: row.usuario_nombre_completo,
    fecha: row.fecha,
  };
}

export function toDisponibilidad(row: ProductoDisponibilidadRow): Disponibilidad {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadMedida: row.unidad_medida,
    stockReal: row.stock_real,
    stockComprometido: row.stock_comprometido,
    stockDisponible: row.stock_real - row.stock_comprometido,
    stockMinimo: row.stock_minimo,
    semaforo: calcularSemaforo(row.stock_real, row.stock_comprometido, row.stock_minimo),
  };
}

export function listKardex(filters: ListKardexFilters): { items: KardexItem[]; total: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.productoId !== undefined) {
    conditions.push('k.producto_id = ?');
    params.push(filters.productoId);
  }
  if (filters.tipoMovimiento !== undefined) {
    conditions.push('k.tipo_movimiento = ?');
    params.push(filters.tipoMovimiento);
  }
  if (filters.fechaDesde !== undefined) {
    conditions.push('k.fecha >= ?');
    params.push(filters.fechaDesde);
  }
  if (filters.fechaHasta !== undefined) {
    conditions.push('k.fecha <= ?');
    params.push(filters.fechaHasta);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM kardex_movimientos k ${where}`).get(...params) as { total: number }
  ).total;
  const rows = db
    .prepare(`${KARDEX_SELECT} ${where} ORDER BY k.fecha DESC, k.id DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as KardexRow[];

  return { items: rows.map(toKardexItem), total };
}

export function findKardexById(id: number): KardexItem | undefined {
  const row = db.prepare(`${KARDEX_SELECT} WHERE k.id = ?`).get(id) as KardexRow | undefined;
  return row ? toKardexItem(row) : undefined;
}

export function listProductosActivos(): Disponibilidad[] {
  const rows = db
    .prepare(
      `SELECT id, codigo, nombre, categoria, unidad_medida, stock_real, stock_comprometido, stock_minimo
       FROM productos_epp WHERE activo = 1 ORDER BY codigo ASC`,
    )
    .all() as ProductoDisponibilidadRow[];
  return rows.map(toDisponibilidad);
}

export function findProductoStock(id: number): ProductoStockRow | undefined {
  return db
    .prepare('SELECT id, codigo, nombre, stock_real, stock_comprometido, activo FROM productos_epp WHERE id = ?')
    .get(id) as ProductoStockRow | undefined;
}

export function calcularDelta(tipoMovimiento: TipoMovimiento, cantidad: number): number {
  return tipoMovimiento === 'SALIDA_VENTA' ? -cantidad : cantidad;
}

export function actualizarStockCondicional(
  productoId: number,
  tipoMovimiento: TipoMovimiento,
  cantidad: number,
  stockAnterior: number,
): boolean {
  const delta = calcularDelta(tipoMovimiento, cantidad);
  let guard = '';
  const guardParams: number[] = [];

  if (tipoMovimiento === 'SALIDA_VENTA') {
    guard = 'AND stock_real - stock_comprometido >= ?';
    guardParams.push(cantidad);
  } else if (tipoMovimiento === 'AJUSTE_MANUAL') {
    guard = 'AND stock_real + ? >= stock_comprometido AND stock_real + ? >= 0';
    guardParams.push(delta, delta);
  }

  const result = db
    .prepare(
      `UPDATE productos_epp
       SET stock_real = stock_real + ?, actualizado_en = datetime('now')
       WHERE id = ? AND stock_real = ? ${guard}`,
    )
    .run(delta, productoId, stockAnterior, ...guardParams);
  return result.changes === 1;
}

export function insertMovimiento(data: CreateMovimientoData): number {
  const result = db
    .prepare(
       `INSERT INTO kardex_movimientos
        (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, observacion,
         usuario_id, costo_unitario, valor_total, verificado_por, verificado_en)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      data.productoId,
      data.tipoMovimiento,
      data.cantidad,
      data.stockAnterior,
      data.stockNuevo,
      data.referencia ?? null,
      data.observacion ?? null,
      data.usuarioId,
      data.costoUnitario ?? 0,
      Number((Math.abs(data.cantidad) * (data.costoUnitario ?? 0)).toFixed(2)),
      data.usuarioId,
    );
  return Number(result.lastInsertRowid);
}

export interface KardexResumenItem {
  productoId: number;
  codigo: string;
  nombre: string;
  entradas: number;
  salidas: number;
  saldo: number;
  valorInvertido: number;
  verificadoPor: string | null;
  verificadoEn: string | null;
}

export function resumenKardex(): KardexResumenItem[] {
  const rows = db
    .prepare(
      `SELECT p.id AS producto_id, p.codigo, p.nombre, p.stock_real AS saldo,
              COALESCE(SUM(CASE WHEN k.tipo_movimiento <> 'SALIDA_VENTA' THEN k.cantidad ELSE 0 END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN k.tipo_movimiento = 'SALIDA_VENTA' THEN k.cantidad ELSE 0 END), 0) AS salidas,
              COALESCE(SUM(CASE WHEN k.tipo_movimiento = 'ENTRADA_COMPRA' THEN k.valor_total ELSE 0 END), 0) AS valor_invertido,
              MAX(k.verificado_en) AS verificado_en,
              (SELECT u.nombre_completo
               FROM kardex_movimientos kv
               JOIN usuarios u ON u.id = kv.verificado_por
               WHERE kv.producto_id = p.id AND kv.verificado_por IS NOT NULL
               ORDER BY kv.verificado_en DESC, kv.id DESC
               LIMIT 1) AS verificado_por_nombre
       FROM productos_epp p
       LEFT JOIN kardex_movimientos k ON k.producto_id = p.id
       WHERE p.activo = 1
       GROUP BY p.id, p.codigo, p.nombre, p.stock_real
       ORDER BY p.codigo`,
    )
    .all() as {
      producto_id: number; codigo: string; nombre: string; saldo: number; entradas: number;
      salidas: number; valor_invertido: number; verificado_en: string | null; verificado_por_nombre: string | null;
    }[];
  return rows.map((row) => ({
    productoId: row.producto_id,
    codigo: row.codigo,
    nombre: row.nombre,
    entradas: row.entradas,
    salidas: row.salidas,
    saldo: row.saldo,
    valorInvertido: row.valor_invertido,
    verificadoPor: row.verificado_por_nombre,
    verificadoEn: row.verificado_en,
  }));
}
