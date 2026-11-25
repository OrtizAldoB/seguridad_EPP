import { NotFoundError } from '../../shared/errors';
import * as repo from './notificaciones.repository';

export function list(filters: { leida?: boolean; page: number; limit: number }) {
  return repo.list(filters);
}

export function marcarLeida(id: number): void {
  if (!repo.existe(id)) throw new NotFoundError('Notificacion no encontrada');
  repo.marcarLeida(id);
}

export function marcarTodas(): void {
  repo.marcarTodas();
}
