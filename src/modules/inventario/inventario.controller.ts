import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import type { ListKardexQuery } from './inventario.schema';
import * as service from './inventario.service';

export const listKardex = asyncHandler(async (req, res) => {
  const { producto_id, tipo_movimiento, fechaDesde, fechaHasta, page, limit } = req.query as unknown as ListKardexQuery;
  const result = service.listKardex({
    productoId: producto_id,
    tipoMovimiento: tipo_movimiento,
    fechaDesde,
    fechaHasta,
    page,
    limit,
  });
  ok(res, result.items, {
    meta: { total: result.total, page, limit, totalPages: Math.ceil(result.total / limit) },
  });
});

export const resumenKardex = asyncHandler(async (_req, res) => {
  ok(res, service.resumenKardex());
});

export const disponibilidad = asyncHandler(async (_req, res) => {
  ok(res, service.disponibilidad());
});

export const alertas = asyncHandler(async (_req, res) => {
  ok(res, service.alertas());
});

export const registrarMovimiento = asyncHandler(async (req, res) => {
  const body = req.body as {
    producto_id: number;
    tipo_movimiento: service.RegistrarMovimientoInput['tipoMovimiento'];
    cantidad: number;
    costo_unitario?: number;
    referencia?: string;
    observacion?: string;
  };
  created(
    res,
    service.registrarMovimiento(
      {
        productoId: body.producto_id,
        tipoMovimiento: body.tipo_movimiento,
        cantidad: body.cantidad,
        costoUnitario: body.costo_unitario,
        referencia: body.referencia,
        observacion: body.observacion,
      },
      req.user!,
    ),
    'Movimiento de inventario registrado',
  );
});
