import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { ok } from '../../shared/response';
import * as service from './notificaciones.service';

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listQuerySchema = z.object({
  leida: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true' || value === '1')),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const list = asyncHandler(async (req, res) => {
  const filters = req.query as unknown as z.infer<typeof listQuerySchema>;
  const result = service.list(filters);
  ok(res, result.items, {
    meta: { total: result.total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(result.total / filters.limit) },
  });
});

export const marcarLeida = asyncHandler(async (req, res) => {
  service.marcarLeida(Number(req.params.id));
  ok(res, { id: Number(req.params.id), leida: true });
});

export const marcarTodas = asyncHandler(async (_req, res) => {
  service.marcarTodas();
  ok(res, { marcadas: true }, { message: 'Notificaciones marcadas como leidas' });
});
