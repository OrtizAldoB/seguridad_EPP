import { asyncHandler } from '../../shared/asyncHandler';
import { ok } from '../../shared/response';
import * as service from './reportes.service';
import type { ExportQuery, ReporteQuery, TopQuery } from './reportes.schema';

export const resumen = asyncHandler(async (req, res) => {
  ok(res, service.resumen(req.query as unknown as ReporteQuery));
});

export const ventas = asyncHandler(async (req, res) => {
  ok(res, service.ventas(req.query as unknown as ReporteQuery));
});

export const cotizaciones = asyncHandler(async (req, res) => {
  ok(res, service.cotizaciones(req.query as unknown as ReporteQuery));
});

export const kardex = asyncHandler(async (req, res) => {
  ok(res, service.kardex(req.query as unknown as ReporteQuery));
});

export const topProductos = asyncHandler(async (req, res) => {
  ok(res, service.topProductos(req.query as unknown as TopQuery));
});

export const topClientes = asyncHandler(async (req, res) => {
  ok(res, service.topClientes(req.query as unknown as TopQuery));
});

export const exportarXlsx = asyncHandler(async (req, res) => {
  await service.exportarXlsx(res, req.query as unknown as ExportQuery);
});

export const exportarPdf = asyncHandler(async (req, res) => {
  service.exportarPdf(res, req.query as unknown as ExportQuery);
});
