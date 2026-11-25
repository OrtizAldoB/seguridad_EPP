import { withImmediateTx } from '../../config/database';
import { ROLES } from '../../shared/constants';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import type { AuthUser } from '../../types/express';
import * as repo from './inventario.repository';
import type { Disponibilidad, KardexItem } from './inventario.repository';
import type { TipoMovimiento } from './inventario.schema';

export interface ListKardexInput {
  productoId?: number;
  tipoMovimiento?: TipoMovimiento;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  limit: number;
}

export interface RegistrarMovimientoInput {
  productoId: number;
  tipoMovimiento: TipoMovimiento;
  cantidad: number;
  costoUnitario?: number;
  referencia?: string;
  observacion?: string;
}

export function listKardex(filters: ListKardexInput): { items: KardexItem[]; total: number } {
  return repo.listKardex(filters);
}

export function disponibilidad(): Disponibilidad[] {
  return repo.listProductosActivos();
}

export function alertas(): Disponibilidad[] {
  return disponibilidad().filter((producto) => producto.semaforo === 'ROJO' || producto.semaforo === 'AMARILLO');
}

export function resumenKardex(): repo.KardexResumenItem[] {
  return repo.resumenKardex();
}

export function registrarMovimiento(input: RegistrarMovimientoInput, actor: AuthUser): KardexItem {
  if (actor.role !== ROLES.ADMINISTRADOR && actor.role !== ROLES.ALMACENERO) {
    throw new ForbiddenError('Solo el administrador o almacenero puede verificar movimientos');
  }
  const usuarioId = actor.id;
  return withImmediateTx(() => {
    const producto = repo.findProductoStock(input.productoId);
    if (!producto) throw new NotFoundError('Producto no encontrado');

    const { cantidad, tipoMovimiento } = input;
    if (cantidad === 0) throw new BadRequestError('La cantidad no puede ser cero');
    if (tipoMovimiento !== 'AJUSTE_MANUAL' && cantidad < 0) {
      throw new BadRequestError('La cantidad debe ser mayor a cero');
    }

    const stockAnterior = producto.stock_real;
    const stockNuevo = stockAnterior + repo.calcularDelta(tipoMovimiento, cantidad);

    if (tipoMovimiento === 'SALIDA_VENTA' && stockAnterior - producto.stock_comprometido < cantidad) {
      throw new ConflictError('Stock disponible insuficiente para la salida');
    }
    if (tipoMovimiento === 'AJUSTE_MANUAL' && (stockNuevo < 0 || stockNuevo < producto.stock_comprometido)) {
      throw new ConflictError('El ajuste dejaria un stock por debajo de lo permitido');
    }

    if (!repo.actualizarStockCondicional(producto.id, tipoMovimiento, cantidad, stockAnterior)) {
      throw new ConflictError('El stock del producto cambio durante la operacion');
    }

    const movimientoId = repo.insertMovimiento({
      productoId: producto.id,
      tipoMovimiento,
      cantidad,
      stockAnterior,
      stockNuevo,
      costoUnitario: input.costoUnitario,
      referencia: input.referencia,
      observacion: input.observacion,
      usuarioId,
    });
    const movimiento = repo.findKardexById(movimientoId);
    if (!movimiento) throw new ConflictError('No se pudo registrar el movimiento');
    return movimiento;
  });
}
