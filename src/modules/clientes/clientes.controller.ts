import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import { listClientesQuerySchema } from './clientes.schema';
import * as service from './clientes.service';

type ListQuery = z.infer<typeof listClientesQuerySchema>;

export const list = asyncHandler(async (req, res) => {
  const { q, estado, page, limit } = req.query as unknown as ListQuery;
  const result = service.list({ q, estado, page, limit });
  ok(res, result, {
    meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, service.getById(Number(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  created(res, service.create(req.body as service.CreateClienteInput), 'Cliente creado');
});

export const update = asyncHandler(async (req, res) => {
  ok(res, service.update(Number(req.params.id), req.body as service.UpdateClienteInput), {
    message: 'Cliente actualizado',
  });
});

export const remove = asyncHandler(async (req, res) => {
  ok(res, service.remove(Number(req.params.id)), { message: 'Cliente desactivado' });
});
