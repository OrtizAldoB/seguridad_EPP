import { withImmediateTx } from '../../config/database';
import { ROLES } from '../../shared/constants';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import type { AuthUser } from '../../types/express';
import { registrarMovimientoReserva } from '../reservas/reservas.repository';
import * as repo from './despacho.repository';
import type { Pedido, PedidoPendiente, PickList } from './despacho.repository';

export interface MovimientoDespacho {
  id: number;
  productoId: number;
  codigo: string;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
}

export interface ResumenDespacho {
  itemsProcesados: number;
  unidadesDespachadas: number;
  notificacionesMarcadas: number;
  movimientos: MovimientoDespacho[];
}

export interface ConfirmarDespachoResult {
  pedido: Pedido;
  resumen: ResumenDespacho;
}

export function pendientes(): PedidoPendiente[] {
  return repo.listPedidosPendientes();
}

export function pickList(pedidoId: number): PickList {
  const pedido = repo.findPedidoById(pedidoId);
  if (!pedido) throw new NotFoundError('Pedido no encontrado');
  return repo.buildPickList(repo.toPedido(pedido), repo.listPedidoDetalles(pedidoId));
}

export function confirmar(pedidoId: number, actor: AuthUser): ConfirmarDespachoResult {
  if (actor.role !== ROLES.ADMINISTRADOR && actor.role !== ROLES.ALMACENERO) {
    throw new ForbiddenError('Solo el administrador o almacenero puede confirmar despachos');
  }
  const usuarioId = actor.id;
  return withImmediateTx(() => {
    const pedido = repo.findPedidoById(pedidoId);
    if (!pedido) throw new NotFoundError('Pedido no encontrado');
    if (pedido.estado !== 'REGISTRADO' && pedido.estado !== 'EN_PREPARACION') {
      throw new ConflictError('El pedido no puede despacharse en su estado actual');
    }

    const detalles = repo.listPedidoDetalles(pedidoId);
    if (detalles.length === 0) throw new ConflictError('El pedido no tiene items para despachar');

    const movimientos: MovimientoDespacho[] = [];
    let unidadesDespachadas = 0;

    for (const detalle of detalles) {
      const producto = repo.findProductoStock(detalle.producto_id);
      if (!producto) throw new NotFoundError(`Producto ${detalle.codigo} no encontrado`);

      const stockAnterior = producto.stock_real;
      const stockNuevo = stockAnterior - detalle.cantidad;
      if (!repo.descontarStockItem(detalle.producto_id, detalle.cantidad)) {
        throw new ConflictError(`Stock insuficiente para el producto ${detalle.codigo}`);
      }
      registrarMovimientoReserva({
        productoId: detalle.producto_id,
        pedidoId,
        tipo: 'DESPACHO',
        cantidad: detalle.cantidad,
        usuarioId,
      });

      const movimientoId = repo.insertMovimientoSalida({
        productoId: detalle.producto_id,
        cantidad: detalle.cantidad,
        stockAnterior,
        stockNuevo,
        referencia: pedido.codigo,
        usuarioId,
      });
      movimientos.push({
        id: movimientoId,
        productoId: detalle.producto_id,
        codigo: detalle.codigo,
        cantidad: detalle.cantidad,
        stockAnterior,
        stockNuevo,
      });
      unidadesDespachadas += detalle.cantidad;
    }

    repo.marcarPedidoDespachado(pedidoId, usuarioId);
    const notificacionesMarcadas = repo.marcarNotificacionesLeidas(pedidoId);
    const actualizado = repo.findPedidoById(pedidoId);
    if (!actualizado) throw new NotFoundError('Pedido no encontrado');

    return {
      pedido: repo.toPedido(actualizado),
      resumen: {
        itemsProcesados: movimientos.length,
        unidadesDespachadas,
        notificacionesMarcadas,
        movimientos,
      },
    };
  });
}
