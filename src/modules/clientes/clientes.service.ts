import type { TipoDocumento } from '../../shared/documentos';
import { ConflictError, NotFoundError } from '../../shared/errors';
import * as repo from './clientes.repository';
import type { Cliente, ListClientesFilters, UpdateClienteData } from './clientes.repository';

export interface CreateClienteInput {
  razonSocial: string;
  nitCi: string;
  tipoDocumento: TipoDocumento;
  telefono?: string;
  email?: string;
  direccion?: string;
  estado: 'ACTIVO' | 'INACTIVO';
}

export type UpdateClienteInput = UpdateClienteData;

export function list(filters: ListClientesFilters): { items: Cliente[]; total: number } {
  return repo.listClientes(filters);
}

export function getById(id: number): Cliente {
  const row = repo.findClienteById(id);
  if (!row) throw new NotFoundError('Cliente no encontrado');
  return repo.toCliente(row);
}

export function create(data: CreateClienteInput): Cliente {
  if (repo.findClienteByNitCi(data.nitCi)) throw new ConflictError('El NIT/CI ya esta registrado');
  return repo.toCliente(repo.createCliente(data));
}

export function update(id: number, data: UpdateClienteInput): Cliente {
  const row = repo.findClienteById(id);
  if (!row) throw new NotFoundError('Cliente no encontrado');

  if (data.nitCi !== undefined) {
    const other = repo.findClienteByNitCi(data.nitCi);
    if (other && other.id !== id) throw new ConflictError('El NIT/CI ya esta registrado');
  }

  repo.updateCliente(id, data);
  return getById(id);
}

export function remove(id: number): Cliente {
  if (!repo.findClienteById(id)) throw new NotFoundError('Cliente no encontrado');
  repo.deactivateCliente(id);
  return getById(id);
}
