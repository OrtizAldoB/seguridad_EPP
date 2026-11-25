import { withImmediateTx } from '../../config/database';
import { DESCUENTO_MAXIMO_SIN_APROBACION, DIAS_POR_MES, ROLES } from '../../shared/constants';
import { fechaMasDiasIso } from '../../shared/fechas';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { calcularTotales, round2 } from '../../shared/pricing';
import type { AuthUser } from '../../types/express';
import { db } from '../../config/database';
import * as repo from './pedidos.repository';
import type { ListPedidosFilters, PedidoDetalleRow, PedidoRow } from './pedidos.repository';

export interface ItemPedidoInput {
  producto_id: number;
  cantidad: number;
  precio_unitario?: number;
  descuento_porcentaje?: number;
}

export interface CrearPedidoInput {
  cliente_id: number;
  items: ItemPedidoInput[];
  condicion_pago: 'CONTADO' | 'CREDITO';
  descuento_porcentaje?: number;
  plazo_meses?: number;
  dias_entrega?: number;
  observacion?: string;
  cotizacion_id?: number | null;
  omitirAprobacion?: boolean;
}

export interface PedidoDetallado extends PedidoRow {
  items: PedidoDetalleRow[];
}

function validarDescuentoCredito(input: CrearPedidoInput, descuento: number, items: ItemPedidoInput[]): void {
  if (
    input.condicion_pago === 'CREDITO' &&
    (descuento > 0 || items.some((item) => (item.descuento_porcentaje ?? 0) > 0))
  ) {
    throw new BadRequestError('No se permiten descuentos en ventas al crédito');
  }
}

const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE_APROBACION: ['CANCELADO'],
  REGISTRADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['CANCELADO'],
  DESPACHADO: [],
  ENTREGADO: [],
  CANCELADO: [],
};

export function list(filters: ListPedidosFilters): { items: PedidoRow[]; total: number } {
  return repo.listPedidos(filters);
}

export function getById(id: number): PedidoDetallado {
  const pedido = repo.findPedidoById(id);
  if (!pedido) throw new NotFoundError('Pedido no encontrado');
  return { ...pedido, items: repo.findDetallesByPedidoId(id) };
}

function normalizeItems(items: ItemPedidoInput[]): ItemPedidoInput[] {
  if (!items.length) throw new BadRequestError('El pedido debe incluir al menos un item');
  const mapa = new Map<number, ItemPedidoInput>();
  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new BadRequestError('Las cantidades deben ser enteros positivos');
    }
    const actual = mapa.get(item.producto_id);
    if (actual) actual.cantidad += item.cantidad;
    else mapa.set(item.producto_id, { ...item });
  }
  return [...mapa.values()];
}

export function crearPedidoTx(input: CrearPedidoInput, usuarioId: number): PedidoRow {
  const cliente = db.prepare('SELECT id, estado FROM clientes WHERE id = ?').get(input.cliente_id) as
    | { id: number; estado: string }
    | undefined;
  if (!cliente || cliente.estado !== 'ACTIVO') throw new BadRequestError('El cliente no existe o esta inactivo');

  const items = normalizeItems(input.items);
  const productos = items.map((item) => {
    const producto = repo.findProductoParaReserva(item.producto_id);
    if (!producto || producto.activo !== 1) throw new NotFoundError(`Producto ${item.producto_id} no disponible`);
    return { item, producto };
  });

  const descuento = input.descuento_porcentaje ?? 0;
  validarDescuentoCredito(input, descuento, items);
  const plazoMeses = input.condicion_pago === 'CREDITO' ? input.plazo_meses || 1 : 0;
  const totales = calcularTotales(
    productos.map(({ item, producto }) => ({
      cantidad: item.cantidad,
      precioUnitario: item.precio_unitario ?? producto.precio_unitario,
      descuentoPorcentaje: item.descuento_porcentaje ?? 0,
    })),
    descuento,
    plazoMeses,
  );

  for (const { item } of productos) {
    if (item.precio_unitario !== undefined && item.precio_unitario < 0) {
      throw new BadRequestError('El precio unitario no puede ser negativo');
    }
  }

  const requiereAprobacion =
    !input.omitirAprobacion &&
    (descuento > DESCUENTO_MAXIMO_SIN_APROBACION || input.condicion_pago === 'CREDITO');
  const estado = requiereAprobacion ? 'PENDIENTE_APROBACION' : 'REGISTRADO';
  const dias = input.dias_entrega ?? 3;
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
    throw new BadRequestError('Los dias de entrega deben estar entre 1 y 90');
  }
  const fechaEntrega = fechaMasDiasIso(dias);

  const pedidoId = repo.insertPedido({
    codigo: repo.nextCodigo('PED', 'pedidos'),
    cotizacionId: input.cotizacion_id ?? null,
    clienteId: input.cliente_id,
    vendedorId: usuarioId,
    estado,
    condicionPago: input.condicion_pago,
    descuentoPorcentaje: descuento,
    subtotal: totales.subtotal,
    descuentoMonto: totales.descuentoMonto,
    impuestoMonto: totales.impuestoMonto,
    interesMonto: totales.interesMonto,
    plazoMeses,
    fechaLimitePago: plazoMeses > 0 ? fechaMasDiasIso(plazoMeses * DIAS_POR_MES) : null,
    total: totales.total,
    fechaEstimadaEntrega: fechaEntrega,
    observacion: input.observacion ?? null,
  });

  for (const { item, producto } of productos) {
    repo.reservarStock(item.producto_id, item.cantidad, producto.codigo, pedidoId, usuarioId);
  }

  for (const { item, producto } of productos) {
    const precio = item.precio_unitario ?? producto.precio_unitario;
    const subtotal = round2(item.cantidad * precio * (1 - (item.descuento_porcentaje ?? 0) / 100));
    repo.insertPedidoDetalle(pedidoId, item.producto_id, item.cantidad, precio, subtotal);
  }

  if (!requiereAprobacion) {
    repo.notifyAlmacen(pedidoId, `Nuevo pedido ${repo.findPedidoById(pedidoId)!.codigo} listo para preparacion`);
  }

  return repo.findPedidoById(pedidoId)!;
}

export function createPedido(input: CrearPedidoInput, usuarioId: number): PedidoRow {
  return withImmediateTx(() => crearPedidoTx(input, usuarioId));
}

export function cambiarEstado(id: number, estado: string, actor: AuthUser): PedidoDetallado {
  return withImmediateTx(() => {
    const pedido = repo.findPedidoById(id);
    if (!pedido) throw new NotFoundError('Pedido no encontrado');
    if (!TRANSICIONES[pedido.estado]?.includes(estado)) {
      throw new ConflictError(`Transicion no permitida: ${pedido.estado} -> ${estado}`);
    }
    if (pedido.estado === 'PENDIENTE_APROBACION' && estado === 'REGISTRADO') {
      throw new ForbiddenError('La aprobación debe hacerse desde la bandeja de aprobaciones');
    }
    if (estado === 'DESPACHADO' || estado === 'ENTREGADO') {
      throw new ConflictError('Use el módulo de despacho para confirmar la salida de stock');
    }
    if (pedido.estado === 'PENDIENTE_APROBACION' && actor.role !== ROLES.ADMINISTRADOR) {
      throw new ForbiddenError('Solo el administrador puede aprobar pedidos');
    }

    if (estado === 'CANCELADO') repo.liberarReserva(id, actor.id);
    repo.updateEstado(id, estado);
    return getById(id);
  });
}

export function liberarReservaTx(pedidoId: number): void {
  repo.liberarReserva(pedidoId);
}
