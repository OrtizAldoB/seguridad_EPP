import { db } from '../../config/database';

export interface PedidoPendienteRow {
  id: number;
  codigo: string;
  cliente_id: number;
  estado: string;
  total: number;
  fecha_estimada_entrega: string;
  creado_en: string;
  cliente_razon_social: string;
  cliente_nit_ci: string;
}

export interface PedidoPendiente {
  id: number;
  codigo: string;
  clienteId: number;
  razonSocial: string;
  nitCi: string;
  estado: string;
  total: number;
  fechaEstimadaEntrega: string;
  creadoEn: string;
}

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
  cliente_razon_social: string;
  cliente_nit_ci: string;
  cliente_direccion: string | null;
  vendedor_nombre_completo: string;
  despachado_por_nombre_completo: string | null;
}

export interface Pedido {
  id: number;
  codigo: string;
  cotizacionId: number | null;
  clienteId: number;
  razonSocial: string;
  nitCi: string;
  direccion: string | null;
  vendedorId: number;
  vendedorNombreCompleto: string;
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
  creadoEn: string;
  actualizadoEn: string;
  despachadoPor: number | null;
  despachadoPorNombreCompleto: string | null;
  despachadoEn: string | null;
  observacion: string | null;
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

export interface PickListItem {
  id: number;
  productoId: number;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  orden: number;
}

export interface OrdenSugeridoItem {
  posicion: number;
  codigo: string;
  nombre: string;
  cantidad: number;
}

export interface PickList {
  pedido: Pedido;
  items: PickListItem[];
  totales: {
    items: number;
    unidades: number;
    subtotal: number;
    descuentoPorcentaje: number;
    descuentoMonto: number;
    impuestoMonto: number;
    interesMonto: number;
    plazoMeses: number;
    fechaLimitePago: string | null;
    total: number;
  };
  ordenSugerido: OrdenSugeridoItem[];
}

export interface ProductoStockDespachoRow {
  id: number;
  codigo: string;
  nombre: string;
  stock_real: number;
  stock_comprometido: number;
}

export interface CreateMovimientoDespachoData {
  productoId: number;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  referencia: string;
  usuarioId: number;
}

const PEDIDO_SELECT = `
  SELECT p.id, p.codigo, p.cotizacion_id, p.cliente_id, p.vendedor_id, p.estado, p.condicion_pago,
          p.descuento_porcentaje, p.subtotal, p.descuento_monto, p.impuesto_monto,
          p.interes_monto, p.plazo_meses, p.fecha_limite_pago,
          p.total, p.fecha_estimada_entrega, p.creado_en, p.actualizado_en,
         p.despachado_por, p.despachado_en, p.observacion,
         c.razon_social AS cliente_razon_social, c.nit_ci AS cliente_nit_ci, c.direccion AS cliente_direccion,
         v.nombre_completo AS vendedor_nombre_completo,
         d.nombre_completo AS despachado_por_nombre_completo
  FROM pedidos p
  JOIN clientes c ON c.id = p.cliente_id
  JOIN usuarios v ON v.id = p.vendedor_id
  LEFT JOIN usuarios d ON d.id = p.despachado_por
`;

export function toPedidoPendiente(row: PedidoPendienteRow): PedidoPendiente {
  return {
    id: row.id,
    codigo: row.codigo,
    clienteId: row.cliente_id,
    razonSocial: row.cliente_razon_social,
    nitCi: row.cliente_nit_ci,
    estado: row.estado,
    total: row.total,
    fechaEstimadaEntrega: row.fecha_estimada_entrega,
    creadoEn: row.creado_en,
  };
}

export function toPedido(row: PedidoRow): Pedido {
  return {
    id: row.id,
    codigo: row.codigo,
    cotizacionId: row.cotizacion_id,
    clienteId: row.cliente_id,
    razonSocial: row.cliente_razon_social,
    nitCi: row.cliente_nit_ci,
    direccion: row.cliente_direccion,
    vendedorId: row.vendedor_id,
    vendedorNombreCompleto: row.vendedor_nombre_completo,
    estado: row.estado,
    condicionPago: row.condicion_pago,
    descuentoPorcentaje: row.descuento_porcentaje,
    subtotal: row.subtotal,
    descuentoMonto: row.descuento_monto,
    impuestoMonto: row.impuesto_monto,
    interesMonto: row.interes_monto,
    plazoMeses: row.plazo_meses,
    fechaLimitePago: row.fecha_limite_pago,
    total: row.total,
    fechaEstimadaEntrega: row.fecha_estimada_entrega,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    despachadoPor: row.despachado_por,
    despachadoPorNombreCompleto: row.despachado_por_nombre_completo,
    despachadoEn: row.despachado_en,
    observacion: row.observacion,
  };
}

export function buildPickList(pedido: Pedido, detalles: PedidoDetalleRow[]): PickList {
  const ordenados = [...detalles].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
  const items: PickListItem[] = ordenados.map((detalle, index) => ({
    id: detalle.id,
    productoId: detalle.producto_id,
    codigo: detalle.codigo,
    nombre: detalle.nombre,
    unidadMedida: detalle.unidad_medida,
    categoria: detalle.categoria,
    cantidad: detalle.cantidad,
    precioUnitario: detalle.precio_unitario,
    subtotal: detalle.subtotal,
    orden: index + 1,
  }));
  const subtotal = items.reduce((suma, item) => suma + item.subtotal, 0);
  const unidades = items.reduce((suma, item) => suma + item.cantidad, 0);
  const descuentoMonto = pedido.descuentoMonto || Number((subtotal * pedido.descuentoPorcentaje / 100).toFixed(2));

  return {
    pedido,
    items,
    totales: {
      items: items.length,
      unidades,
      subtotal: Number(subtotal.toFixed(2)),
      descuentoPorcentaje: pedido.descuentoPorcentaje,
      descuentoMonto,
      impuestoMonto: pedido.impuestoMonto,
      interesMonto: pedido.interesMonto,
      plazoMeses: pedido.plazoMeses,
      fechaLimitePago: pedido.fechaLimitePago,
      total: pedido.total,
    },
    ordenSugerido: items.map((item) => ({
      posicion: item.orden,
      codigo: item.codigo,
      nombre: item.nombre,
      cantidad: item.cantidad,
    })),
  };
}

export function listPedidosPendientes(): PedidoPendiente[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.codigo, p.cliente_id, p.estado, p.total, p.fecha_estimada_entrega, p.creado_en,
              c.razon_social AS cliente_razon_social, c.nit_ci AS cliente_nit_ci
       FROM pedidos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.estado IN ('REGISTRADO', 'EN_PREPARACION')
       ORDER BY p.fecha_estimada_entrega ASC, p.creado_en ASC, p.id ASC`,
    )
    .all() as PedidoPendienteRow[];
  return rows.map(toPedidoPendiente);
}

export function findPedidoById(id: number): PedidoRow | undefined {
  return db.prepare(`${PEDIDO_SELECT} WHERE p.id = ?`).get(id) as PedidoRow | undefined;
}

export function listPedidoDetalles(pedidoId: number): PedidoDetalleRow[] {
  return db
    .prepare(
      `SELECT pd.id, pd.pedido_id, pd.producto_id, pd.cantidad, pd.precio_unitario, pd.subtotal,
              pr.codigo, pr.nombre, pr.unidad_medida, pr.categoria
       FROM pedido_detalles pd
       JOIN productos_epp pr ON pr.id = pd.producto_id
       WHERE pd.pedido_id = ?
       ORDER BY pr.codigo ASC, pd.id ASC`,
    )
    .all(pedidoId) as PedidoDetalleRow[];
}

export function findProductoStock(id: number): ProductoStockDespachoRow | undefined {
  return db
    .prepare('SELECT id, codigo, nombre, stock_real, stock_comprometido FROM productos_epp WHERE id = ?')
    .get(id) as ProductoStockDespachoRow | undefined;
}

export function descontarStockItem(productoId: number, cantidad: number): boolean {
  const result = db
    .prepare(
      `UPDATE productos_epp
       SET stock_real = stock_real - ?, stock_comprometido = stock_comprometido - ?, actualizado_en = datetime('now')
       WHERE id = ? AND stock_real >= ? AND stock_comprometido >= ?`,
    )
    .run(cantidad, cantidad, productoId, cantidad, cantidad);
  return result.changes === 1;
}

export function insertMovimientoSalida(data: CreateMovimientoDespachoData): number {
  const result = db
    .prepare(
       `INSERT INTO kardex_movimientos
        (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, observacion,
         usuario_id, verificado_por, verificado_en)
        VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      data.productoId,
      data.cantidad,
      data.stockAnterior,
      data.stockNuevo,
      data.referencia,
      `Despacho de pedido ${data.referencia}`,
      data.usuarioId,
      data.usuarioId,
    );
  return Number(result.lastInsertRowid);
}

export function marcarPedidoDespachado(pedidoId: number, usuarioId: number): void {
  db.prepare(
    `UPDATE pedidos
     SET estado = 'ENTREGADO', despachado_por = ?, despachado_en = datetime('now'), actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(usuarioId, pedidoId);
}

export function marcarNotificacionesLeidas(pedidoId: number): number {
  const result = db
    .prepare('UPDATE notificaciones_almacen SET leida = 1 WHERE pedido_id = ? AND leida = 0')
    .run(pedidoId);
  return result.changes;
}
