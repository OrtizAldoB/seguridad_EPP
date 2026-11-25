import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import { listProductosQuerySchema } from './productos.schema';
import * as service from './productos.service';

type ListQuery = z.infer<typeof listProductosQuerySchema>;

export const list = asyncHandler(async (req, res) => {
  const { q, categoria, activo, page, limit } = req.query as unknown as ListQuery;
  const result = service.list({ q, categoria, activo, page, limit });
  ok(res, result, {
    meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
  });
});

export const categorias = asyncHandler(async (_req, res) => {
  ok(res, service.categorias());
});

export const alertas = asyncHandler(async (_req, res) => {
  ok(res, service.alertas());
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, service.getById(Number(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  created(res, service.create(req.body as service.CreateProductoInput), 'Producto creado');
});

export const update = asyncHandler(async (req, res) => {
  ok(res, service.update(Number(req.params.id), req.body as service.UpdateProductoInput), {
    message: 'Producto actualizado',
  });
});

export const remove = asyncHandler(async (req, res) => {
  ok(res, service.remove(Number(req.params.id)), { message: 'Producto desactivado' });
});
