import { db } from '../../config/database';
import { TIPOS_MOVIMIENTO } from '../../shared/constants';
import { BadRequestError } from '../../shared/errors';
import { calcularSemaforo } from '../../shared/semaphore';
import type { Periodo, ReporteQuery } from './reportes.schema';

type FiltrosRango = Pick<ReporteQuery, 'periodo' | 'desde' | 'hasta'>;
type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export interface Rango {
  desde: string;
  hasta: string;
}

export interface Indicadores {
  totalVendido: number;
  cantidadPedidos: number;
  totalCotizaciones: number;
}

export interface SeriePunto {
  etiqueta: string;
  cantidad: number;
  monto: number;
}

export interface VentaRow {
  pedido_id: number;
  pedido_codigo: string;
  cliente_id: number;
  cliente_razon_social: string;
  cliente_nit_ci: string;
  vendedor_id: number;
  vendedor_nombre_completo: string;
  estado: string;
  pedido_total: number;
  creado_en: string;
  producto_id: number | null;
  producto_codigo: string | null;
  producto_nombre: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  detalle_subtotal: number | null;
}

export interface VentaItem {
  pedidoId: number;
  pedidoCodigo: string;
  clienteId: number;
  clienteRazonSocial: string;
  clienteNitCi: string;
  vendedorId: number;
  vendedorNombreCompleto: string;
  estado: string;
  pedidoTotal: number;
  creadoEn: string;
  productoId: number | null;
  productoCodigo: string | null;
  productoNombre: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  subtotal: number | null;
}

export interface CotizacionRow {
  id: number;
  codigo: string;
  cliente_id: number;
  cliente_razon_social: string;
  cliente_nit_ci: string;
  vendedor_id: number;
  vendedor_nombre_completo: string;
  total: number;
  estado: string;
  fecha_emision: string;
  fecha_vencimiento: string;
}

export interface CotizacionItem {
  id: number;
  codigo: string;
  clienteId: number;
  clienteRazonSocial: string;
  clienteNitCi: string;
  vendedorId: number;
  vendedorNombreCompleto: string;
  total: number;
  estado: string;
  fechaEmision: string;
  fechaVencimiento: string;
}

export interface KardexRow {
  id: number;
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  referencia: string | null;
  observacion: string | null;
  usuario_id: number;
  usuario_nombre_completo: string;
  verificado_por_nombre_completo: string | null;
  verificado_en: string | null;
  fecha: string;
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
  referencia: string | null;
  observacion: string | null;
  usuarioId: number;
  usuarioNombreCompleto: string;
  verificadoPor: string | null;
  verificadoEn: string | null;
  fecha: string;
}

export interface TopProductoRow {
  producto_id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  cantidad_vendida: number;
  monto: number;
}

export interface TopProductoItem {
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidadMedida: string;
  cantidadVendida: number;
  monto: number;
}

export interface TopClienteRow {
  cliente_id: number;
  razon_social: string;
  nit_ci: string;
  cantidad_pedidos: number;
  monto_total: number;
}

export interface TopClienteItem {
  clienteId: number;
  razonSocial: string;
  nitCi: string;
  cantidadPedidos: number;
  montoTotal: number;
}

export function resolverRango(filtros: FiltrosRango): Rango {
  const desdeSql: Record<Periodo, string> = {
    diario: "date('now')",
    semanal: "date('now','-6 days')",
    mensual: "date('now','-29 days')",
    personalizado: '?',
  };
  const params: string[] = [];
  if (filtros.periodo === 'personalizado') {
    if (!filtros.desde || !filtros.hasta) {
      throw new BadRequestError('El periodo personalizado requiere desde y hasta');
    }
    params.push(filtros.desde, filtros.hasta);
  }
  const hastaSql = filtros.periodo === 'personalizado' ? '?' : "date('now')";
  return db.prepare(`SELECT ${desdeSql[filtros.periodo]} AS desde, ${hastaSql} AS hasta`).get(...params) as Rango;
}

export function obtenerIndicadores(rango: Rango): Indicadores {
  const ventas = db
    .prepare(
      `SELECT COALESCE(SUM(p.total), 0) AS totalVendido, COUNT(*) AS cantidadPedidos
       FROM pedidos p
       WHERE date(p.creado_en) BETWEEN ? AND ?
         AND p.estado NOT IN ('CANCELADO', 'PENDIENTE_APROBACION')`,
    )
    .get(rango.desde, rango.hasta) as { totalVendido: number; cantidadPedidos: number };
  const cotizaciones = db
    .prepare(`SELECT COUNT(*) AS total FROM cotizaciones c WHERE date(c.fecha_emision) BETWEEN ? AND ?`)
    .get(rango.desde, rango.hasta) as { total: number };
  return { ...ventas, totalCotizaciones: cotizaciones.total };
}

function expresionSerie(rango: Rango, periodo: Periodo): string {
  if (periodo === 'diario') return 'date(p.creado_en)';
  if (periodo === 'semanal') return "date(p.creado_en, '-6 days', 'weekday 1')";
  if (periodo === 'mensual') return "strftime('%Y-%m', p.creado_en)";
  const dias = (
    db.prepare('SELECT julianday(?) - julianday(?) + 1 AS dias').get(rango.hasta, rango.desde) as { dias: number }
  ).dias;
  return dias <= 31 ? 'date(p.creado_en)' : "strftime('%Y-%m', p.creado_en)";
}

export function obtenerSerieVentas(rango: Rango, periodo: Periodo): SeriePunto[] {
  const expresion = expresionSerie(rango, periodo);
  return db
    .prepare(
      `SELECT ${expresion} AS etiqueta, COUNT(*) AS cantidad, COALESCE(SUM(p.total), 0) AS monto
       FROM pedidos p
       WHERE date(p.creado_en) BETWEEN ? AND ?
         AND p.estado NOT IN ('CANCELADO', 'PENDIENTE_APROBACION')
       GROUP BY etiqueta ORDER BY etiqueta ASC`,
    )
    .all(rango.desde, rango.hasta) as SeriePunto[];
}

export function contarClientesActivos(): number {
  return (db.prepare("SELECT COUNT(*) AS total FROM clientes WHERE estado = 'ACTIVO'").get() as { total: number }).total;
}

export function contarAlertasStock(): number {
  const rows = db
    .prepare('SELECT stock_real, stock_comprometido, stock_minimo FROM productos_epp WHERE activo = 1')
    .all() as { stock_real: number; stock_comprometido: number; stock_minimo: number }[];
  return rows.filter((row) => {
    const semaforo = calcularSemaforo(row.stock_real, row.stock_comprometido, row.stock_minimo);
    return semaforo === 'ROJO' || semaforo === 'AMARILLO';
  }).length;
}

export function listarVentas(rango: Rango): VentaItem[] {
  const rows = db
    .prepare(
      `SELECT p.id AS pedido_id, p.codigo AS pedido_codigo, p.cliente_id, c.razon_social AS cliente_razon_social,
              c.nit_ci AS cliente_nit_ci, p.vendedor_id, u.nombre_completo AS vendedor_nombre_completo,
              p.estado, p.total AS pedido_total, p.creado_en,
              pr.id AS producto_id, pr.codigo AS producto_codigo, pr.nombre AS producto_nombre,
              pd.cantidad, pd.precio_unitario, pd.subtotal AS detalle_subtotal
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.vendedor_id
       LEFT JOIN pedido_detalles pd ON pd.pedido_id = p.id
       LEFT JOIN productos_epp pr ON pr.id = pd.producto_id
       WHERE date(p.creado_en) BETWEEN ? AND ?
         AND p.estado NOT IN ('CANCELADO', 'PENDIENTE_APROBACION')
       ORDER BY p.creado_en DESC, p.id DESC, pr.codigo ASC`,
    )
    .all(rango.desde, rango.hasta) as VentaRow[];
  return rows.map((row) => ({
    pedidoId: row.pedido_id,
    pedidoCodigo: row.pedido_codigo,
    clienteId: row.cliente_id,
    clienteRazonSocial: row.cliente_razon_social,
    clienteNitCi: row.cliente_nit_ci,
    vendedorId: row.vendedor_id,
    vendedorNombreCompleto: row.vendedor_nombre_completo,
    estado: row.estado,
    pedidoTotal: row.pedido_total,
    creadoEn: row.creado_en,
    productoId: row.producto_id,
    productoCodigo: row.producto_codigo,
    productoNombre: row.producto_nombre,
    cantidad: row.cantidad,
    precioUnitario: row.precio_unitario,
    subtotal: row.detalle_subtotal,
  }));
}

export function listarCotizaciones(rango: Rango): CotizacionItem[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.codigo, c.cliente_id, cl.razon_social AS cliente_razon_social, cl.nit_ci AS cliente_nit_ci,
              c.vendedor_id, u.nombre_completo AS vendedor_nombre_completo,
              c.total, c.estado, c.fecha_emision, c.fecha_vencimiento
       FROM cotizaciones c
       JOIN clientes cl ON cl.id = c.cliente_id
       JOIN usuarios u ON u.id = c.vendedor_id
       WHERE date(c.fecha_emision) BETWEEN ? AND ?
       ORDER BY c.fecha_emision DESC, c.id DESC`,
    )
    .all(rango.desde, rango.hasta) as CotizacionRow[];
  return rows.map((row) => ({
    id: row.id,
    codigo: row.codigo,
    clienteId: row.cliente_id,
    clienteRazonSocial: row.cliente_razon_social,
    clienteNitCi: row.cliente_nit_ci,
    vendedorId: row.vendedor_id,
    vendedorNombreCompleto: row.vendedor_nombre_completo,
    total: row.total,
    estado: row.estado,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_vencimiento,
  }));
}

export function listarKardex(rango: Rango): KardexItem[] {
  const rows = db
    .prepare(
      `SELECT k.id, k.producto_id, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
              k.tipo_movimiento, k.cantidad, k.stock_anterior, k.stock_nuevo,
               k.referencia, k.observacion, k.usuario_id, u.nombre_completo AS usuario_nombre_completo,
               k.verificado_en, v.nombre_completo AS verificado_por_nombre_completo, k.fecha
        FROM kardex_movimientos k
        JOIN productos_epp p ON p.id = k.producto_id
        JOIN usuarios u ON u.id = k.usuario_id
        LEFT JOIN usuarios v ON v.id = k.verificado_por
       WHERE date(k.fecha) BETWEEN ? AND ?
       ORDER BY k.fecha DESC, k.id DESC`,
    )
    .all(rango.desde, rango.hasta) as KardexRow[];
  return rows.map((row) => ({
    id: row.id,
    productoId: row.producto_id,
    productoCodigo: row.producto_codigo,
    productoNombre: row.producto_nombre,
    tipoMovimiento: row.tipo_movimiento,
    cantidad: row.cantidad,
    stockAnterior: row.stock_anterior,
    stockNuevo: row.stock_nuevo,
    referencia: row.referencia,
    observacion: row.observacion,
    usuarioId: row.usuario_id,
    usuarioNombreCompleto: row.usuario_nombre_completo,
    verificadoPor: row.verificado_por_nombre_completo,
    verificadoEn: row.verificado_en,
    fecha: row.fecha,
  }));
}

export function listarTopProductos(rango: Rango, limit: number): TopProductoItem[] {
  const rows = db
    .prepare(
      `SELECT pr.id AS producto_id, pr.codigo, pr.nombre, pr.categoria, pr.unidad_medida,
              SUM(pd.cantidad) AS cantidad_vendida, COALESCE(SUM(pd.subtotal), 0) AS monto
       FROM pedido_detalles pd
       JOIN pedidos p ON p.id = pd.pedido_id
       JOIN productos_epp pr ON pr.id = pd.producto_id
       WHERE date(p.creado_en) BETWEEN ? AND ?
         AND p.estado NOT IN ('CANCELADO', 'PENDIENTE_APROBACION')
       GROUP BY pr.id
       ORDER BY cantidad_vendida DESC, monto DESC, pr.codigo ASC
       LIMIT ?`,
    )
    .all(rango.desde, rango.hasta, limit) as TopProductoRow[];
  return rows.map((row) => ({
    productoId: row.producto_id,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadMedida: row.unidad_medida,
    cantidadVendida: row.cantidad_vendida,
    monto: row.monto,
  }));
}

export function listarTopClientes(rango: Rango, limit: number): TopClienteItem[] {
  const rows = db
    .prepare(
      `SELECT c.id AS cliente_id, c.razon_social, c.nit_ci,
              COUNT(p.id) AS cantidad_pedidos, COALESCE(SUM(p.total), 0) AS monto_total
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE date(p.creado_en) BETWEEN ? AND ?
         AND p.estado NOT IN ('CANCELADO', 'PENDIENTE_APROBACION')
       GROUP BY c.id
       ORDER BY monto_total DESC, cantidad_pedidos DESC, c.razon_social ASC
       LIMIT ?`,
    )
    .all(rango.desde, rango.hasta, limit) as TopClienteRow[];
  return rows.map((row) => ({
    clienteId: row.cliente_id,
    razonSocial: row.razon_social,
    nitCi: row.nit_ci,
    cantidadPedidos: row.cantidad_pedidos,
    montoTotal: row.monto_total,
  }));
}
