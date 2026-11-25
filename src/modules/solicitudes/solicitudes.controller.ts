import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import { listSolicitudesQuerySchema } from './solicitudes.schema';
import * as service from './solicitudes.service';

type ListQuery = z.infer<typeof listSolicitudesQuerySchema>;

export const list = asyncHandler(async (req, res) => {
  const { q, estado, proveedor_id, page, limit } = req.query as unknown as ListQuery;
  const result = service.list({ q, estado, proveedor_id, page, limit });
  ok(res, result, { meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) } });
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, service.getById(Number(req.params.id)));
});

export const create = asyncHandler(async (req, res) => {
  created(res, service.create(req.body as service.CreateSolicitudInput, req.user!.id), 'Solicitud registrada');
});

export const aprobar = asyncHandler(async (req, res) => {
  ok(res, service.aprobar(Number(req.params.id), req.user!.id), {
    message: 'Solicitud aprobada y compra generada automáticamente',
  });
});

export const rechazar = asyncHandler(async (req, res) => {
  const body = req.body as { motivo_rechazo?: string };
  ok(res, service.rechazar(Number(req.params.id), req.user!.id, body.motivo_rechazo), { message: 'Solicitud rechazada' });
});
