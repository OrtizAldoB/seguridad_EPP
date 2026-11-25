import { asyncHandler } from '../../shared/asyncHandler';
import { ok } from '../../shared/response';
import * as service from './despacho.service';

export const pendientes = asyncHandler(async (_req, res) => {
  ok(res, service.pendientes());
});

export const pickList = asyncHandler(async (req, res) => {
  ok(res, service.pickList(Number(req.params.pedidoId)));
});

export const confirmar = asyncHandler(async (req, res) => {
  ok(res, service.confirmar(Number(req.params.pedidoId), req.user!), { message: 'Despacho confirmado' });
});
