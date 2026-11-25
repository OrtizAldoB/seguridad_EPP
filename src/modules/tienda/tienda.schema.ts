import { z } from 'zod';

export const catalogoQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    categoria: z.string().trim().max(80).optional(),
  })
  .strict();

export const itemCarritoSchema = z
  .object({
    productoId: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().positive().max(999),
  })
  .strict();

export const productoParamSchema = z.object({ productoId: z.coerce.number().int().positive() }).strict();

export const cantidadSchema = z.object({ cantidad: z.coerce.number().int().positive().max(999) }).strict();

export const checkoutSchema = z
  .object({
    condicionPago: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
    observacion: z.string().trim().max(500).optional(),
    diasEntrega: z.number().int().min(1).max(90).default(3),
  })
  .strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
