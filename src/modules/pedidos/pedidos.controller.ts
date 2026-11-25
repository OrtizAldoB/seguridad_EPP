import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import { listPedidosQuerySchema } from './pedidos.schema';
import * as service from './pedidos.service';
import type { CrearPedidoInput } from './pedidos.service';

type ListQuery = z.infer<typeof listPedidosQuerySchema>;

export const list = asyncHandler(async (req, res) => {
  const filters = req.query as unknown as ListQuery;
  const result = service.list(filters);
  ok(res, result.items, {
    meta: { total: result.total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(result.total / filters.limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, service.getById(Number(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  created(res, service.createPedido(req.body as CrearPedidoInput, req.user!.id), 'Pedido registrado');
});

export const cambiarEstado = asyncHandler(async (req, res) => {
  const { estado } = req.body as { estado: string };
  ok(res, service.cambiarEstado(Number(req.params.id), estado, req.user!), { message: 'Estado actualizado' });
});
