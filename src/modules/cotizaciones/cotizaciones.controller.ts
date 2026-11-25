import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import { listCotizacionesQuerySchema } from './cotizaciones.schema';
import * as service from './cotizaciones.service';
import type { ActualizarCotizacionInput, CrearCotizacionInput } from './cotizaciones.service';

type ListQuery = z.infer<typeof listCotizacionesQuerySchema>;

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
  created(res, service.create(req.body as CrearCotizacionInput, req.user!.id), 'Cotizacion registrada');
});

export const update = asyncHandler(async (req, res) => {
  ok(res, service.update(Number(req.params.id), req.body as ActualizarCotizacionInput), {
    message: 'Cotizacion actualizada',
  });
});

export const aceptar = asyncHandler(async (req, res) => {
  ok(res, service.aceptar(Number(req.params.id)), { message: 'Cotizacion aceptada' });
});

export const rechazar = asyncHandler(async (req, res) => {
  ok(res, service.rechazar(Number(req.params.id)), { message: 'Cotizacion rechazada' });
});

export const convertir = asyncHandler(async (req, res) => {
  created(res, service.convertir(Number(req.params.id), req.user!.id), 'Pedido generado desde cotizacion');
});
