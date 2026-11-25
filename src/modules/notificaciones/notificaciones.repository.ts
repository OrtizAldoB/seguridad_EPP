import { db } from '../../config/database';

export interface NotificacionRow {
  id: number;
  pedido_id: number;
  mensaje: string;
  leida: number;
  creada_en: string;
  pedido_codigo?: string;
}

export function list(filters: { leida?: boolean; page: number; limit: number }): {
  items: NotificacionRow[];
  total: number;
} {
  const where = filters.leida === undefined ? '' : 'WHERE n.leida = ?';
  const params = filters.leida === undefined ? [] : [filters.leida ? 1 : 0];
  const total = (
    db.prepare(`SELECT COUNT(*) AS total FROM notificaciones_almacen n ${where}`).get(...params) as { total: number }
  ).total;
  const items = db
    .prepare(
      `SELECT n.*, p.codigo AS pedido_codigo FROM notificaciones_almacen n
       JOIN pedidos p ON p.id = n.pedido_id ${where}
       ORDER BY n.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, (filters.page - 1) * filters.limit) as NotificacionRow[];
  return { items, total };
}

export function marcarLeida(id: number): void {
  db.prepare('UPDATE notificaciones_almacen SET leida = 1 WHERE id = ?').run(id);
}

export function marcarTodas(): void {
  db.prepare('UPDATE notificaciones_almacen SET leida = 1 WHERE leida = 0').run();
}

export function existe(id: number): boolean {
  return !!db.prepare('SELECT id FROM notificaciones_almacen WHERE id = ?').get(id);
}
