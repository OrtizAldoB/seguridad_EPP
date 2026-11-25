import { z } from 'zod';
import { TIPOS_MOVIMIENTO } from '../../shared/constants';

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/, 'Formato de fecha invalido')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Fecha invalida');

function normalizarDesde(value: string): string {
  const normalizada = value.replace('T', ' ');
  if (normalizada.length === 10) return `${normalizada} 00:00:00`;
  return normalizada.length === 16 ? `${normalizada}:00` : normalizada;
}

function normalizarHasta(value: string): string {
  const normalizada = value.replace('T', ' ');
  if (normalizada.length === 10) return `${normalizada} 23:59:59`;
  return normalizada.length === 16 ? `${normalizada}:59` : normalizada;
}

export const listKardexQuerySchema = z
  .object({
    producto_id: z.coerce.number().int().positive().optional(),
    tipo_movimiento: z.enum(TIPOS_MOVIMIENTO).optional(),
    fechaDesde: fecha.optional().transform((value) => (value === undefined ? undefined : normalizarDesde(value))),
    fechaHasta: fecha.optional().transform((value) => (value === undefined ? undefined : normalizarHasta(value))),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((value) => !value.fechaDesde || !value.fechaHasta || value.fechaDesde <= value.fechaHasta, {
    message: 'fechaDesde no puede ser mayor que fechaHasta',
    path: ['fechaDesde'],
  });

export const createMovimientoSchema = z
  .object({
    producto_id: z.coerce.number().int().positive(),
    tipo_movimiento: z.enum(TIPOS_MOVIMIENTO),
    cantidad: z.number().int(),
    costo_unitario: z.number().min(0).optional(),
    referencia: z.string().trim().min(1).max(100).optional(),
    observacion: z.string().trim().max(500).optional(),
  })
  .strict();

export type TipoMovimiento = z.infer<typeof createMovimientoSchema>['tipo_movimiento'];
export type ListKardexQuery = z.infer<typeof listKardexQuerySchema>;
export type CreateMovimientoBody = z.infer<typeof createMovimientoSchema>;
