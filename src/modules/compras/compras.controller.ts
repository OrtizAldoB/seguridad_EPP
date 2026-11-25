import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import { listComprasQuerySchema } from './compras.schema';
import * as service from './compras.service';

type ListQuery = z.infer<typeof listComprasQuerySchema>;
export const list = asyncHandler(async (req, res) => {
  const { q, estado, proveedor_id, page, limit } = req.query as unknown as ListQuery;
  const result = service.list({ q, estado, proveedor_id, page, limit });
  ok(res, result, { meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) } });
});
export const getById = asyncHandler(async (req, res) => { ok(res, service.getById(Number(req.params.id))); });
export const create = asyncHandler(async (req, res) => { created(res, service.create(req.body as service.CreateCompraInput, req.user!.id), 'Compra registrada'); });
export const recibir = asyncHandler(async (req, res) => { ok(res, service.recibir(Number(req.params.id), req.user!.id), { message: 'Compra recibida e ingresada a stock' }); });
export const cancelar = asyncHandler(async (req, res) => { ok(res, service.cancelar(Number(req.params.id)), { message: 'Compra cancelada' }); });
