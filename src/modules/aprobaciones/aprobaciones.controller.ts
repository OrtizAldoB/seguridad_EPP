import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { ok } from '../../shared/response';
import * as service from './aprobaciones.service';
import type { Decision } from './aprobaciones.service';

export const decisionSchema = z
  .object({
    decision: z.enum(['APROBADO', 'RECHAZADO']),
    observacion: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const historialQuerySchema = z.object({
  decision: z.enum(['APROBADO', 'RECHAZADO']).optional(),
  tipo: z.enum(['DESCUENTO_ESPECIAL', 'VENTA_CREDITO']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pendientes = asyncHandler(async (_req, res) => {
  ok(res, service.pendientes());
});

export const decidirCotizacion = asyncHandler(async (req, res) => {
  const { decision, observacion } = req.body as { decision: Decision; observacion?: string };
  service.decidirCotizacion(Number(req.params.id), decision, observacion ?? null, req.user!.id);
  ok(res, { id: Number(req.params.id), decision }, { message: `Cotizacion ${decision.toLowerCase()}` });
});

export const decidirPedido = asyncHandler(async (req, res) => {
  const { decision, observacion } = req.body as { decision: Decision; observacion?: string };
  service.decidirPedido(Number(req.params.id), decision, observacion ?? null, req.user!.id);
  ok(res, { id: Number(req.params.id), decision }, { message: `Pedido ${decision.toLowerCase()}` });
});

export const historial = asyncHandler(async (req, res) => {
  const filters = req.query as unknown as z.infer<typeof historialQuerySchema>;
  const result = service.historial(filters);
  ok(res, result.items, {
    meta: { total: result.total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(result.total / filters.limit) },
  });
});
