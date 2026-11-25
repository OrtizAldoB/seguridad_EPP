import { withImmediateTx } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/errors';
import * as repo from './aprobaciones.repository';
import type { AuditoriaRow, PendienteRow } from './aprobaciones.repository';

export type Decision = 'APROBADO' | 'RECHAZADO';

export interface Pendientes {
  cotizaciones: PendienteRow[];
  pedidos: PendienteRow[];
}

export function pendientes(): Pendientes {
  return { cotizaciones: repo.findCotizacionesParaAprobar(), pedidos: repo.findPedidosParaAprobar() };
}

export function decidirCotizacion(id: number, decision: Decision, observacion: string | null, usuarioId: number): void {
  withImmediateTx(() => {
    const cotizacion = repo.findCotizacion(id);
    if (!cotizacion) throw new NotFoundError('Cotizacion no encontrada');
    if (!['ENVIADA', 'ACEPTADA'].includes(cotizacion.estado) || cotizacion.aprobada_en) {
      throw new ConflictError(`La cotizacion no esta pendiente de aprobacion (${cotizacion.estado})`);
    }

    for (const tipo of repo.tiposDe(cotizacion.descuento_porcentaje, cotizacion.condicion_pago)) {
      repo.insertAuditoria({ pedidoId: null, cotizacionId: id, usuarioId, tipo, decision, observacion });
    }
    if (decision === 'APROBADO') repo.marcarCotizacionAprobada(id);
    else repo.setCotizacionEstado(id, 'RECHAZADA');
  });
}

export function decidirPedido(id: number, decision: Decision, observacion: string | null, usuarioId: number): void {
  withImmediateTx(() => {
    const pedido = repo.findPedido(id);
    if (!pedido) throw new NotFoundError('Pedido no encontrado');
    if (pedido.estado !== 'PENDIENTE_APROBACION') {
      throw new ConflictError(`El pedido no esta pendiente de aprobacion (${pedido.estado})`);
    }

    for (const tipo of repo.tiposDe(pedido.descuento_porcentaje, pedido.condicion_pago)) {
      repo.insertAuditoria({ pedidoId: id, cotizacionId: null, usuarioId, tipo, decision, observacion });
    }

    if (decision === 'APROBADO') {
      repo.setPedidoEstado(id, 'REGISTRADO');
      repo.notifyAlmacen(id, `Pedido ${pedido.codigo} aprobado e ingresado a almacen`);
    } else {
      repo.liberarReserva(id, usuarioId);
      repo.setPedidoEstado(id, 'CANCELADO');
    }
  });
}

export function historial(filters: { decision?: string; tipo?: string; page: number; limit: number }): {
  items: AuditoriaRow[];
  total: number;
} {
  return repo.listHistorial(filters);
}
