import { db } from '../../config/database';

export type TipoMovimientoReserva = 'RESERVA' | 'LIBERACION' | 'DESPACHO';

export interface MovimientoReserva {
  id: number;
  producto_id: number;
  pedido_id: number;
  tipo: TipoMovimientoReserva;
  cantidad: number;
  usuario_id: number | null;
  creado_en: string;
}

export function registrarMovimientoReserva(data: {
  productoId: number;
  pedidoId: number;
  tipo: TipoMovimientoReserva;
  cantidad: number;
  usuarioId?: number;
}): void {
  db.prepare(
    `INSERT INTO reservas_stock (producto_id, pedido_id, tipo, cantidad, usuario_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(data.productoId, data.pedidoId, data.tipo, data.cantidad, data.usuarioId ?? null);
}

export function listarMovimientosReserva(pedidoId: number): MovimientoReserva[] {
  return db
    .prepare('SELECT * FROM reservas_stock WHERE pedido_id = ? ORDER BY id')
    .all(pedidoId) as MovimientoReserva[];
}
