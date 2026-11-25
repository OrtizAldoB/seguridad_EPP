import { z } from 'zod';
import { fechaNoPasadaSchema } from '../../shared/fechas';

export const ESTADOS_COMPRA = ['REGISTRADA', 'RECIBIDA', 'CANCELADA'] as const;
export type EstadoCompra = (typeof ESTADOS_COMPRA)[number];

const itemSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().positive(),
  costo_unitario: z.coerce.number().nonnegative(),
}).strict();

export const createCompraSchema = z.object({
  proveedor_id: z.coerce.number().int().positive(),
  observacion: z.string().trim().max(500).optional(),
  fecha_emision: fechaNoPasadaSchema.optional(),
  items: z.array(itemSchema).min(1),
}).strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
export const listComprasQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS_COMPRA).optional(),
  proveedor_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
