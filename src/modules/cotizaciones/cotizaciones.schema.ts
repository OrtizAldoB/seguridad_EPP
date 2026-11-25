import { z } from 'zod';
import { ESTADOS_COTIZACION } from '../../shared/constants';

const itemCotizacionSchema = z
  .object({
    producto_id: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().positive(),
    precio_unitario: z.number().min(0).optional(),
    descuento_porcentaje: z.number().min(0).max(100).optional(),
  })
  .strict();

export const crearCotizacionSchema = z
  .object({
    cliente_id: z.coerce.number().int().positive(),
    items: z.array(itemCotizacionSchema).min(1),
    condicion_pago: z.enum(['CONTADO', 'CREDITO']),
    descuento_porcentaje: z.number().min(0).max(100).default(0),
    plazo_meses: z.number().int().min(0).max(12).default(0),
    observacion: z.string().trim().max(500).optional(),
  })
  .strict();

export const actualizarCotizacionSchema = z
  .object({
    items: z.array(itemCotizacionSchema).min(1).optional(),
    condicion_pago: z.enum(['CONTADO', 'CREDITO']).optional(),
    descuento_porcentaje: z.number().min(0).max(100).optional(),
    plazo_meses: z.number().int().min(0).max(12).optional(),
    observacion: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listCotizacionesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cliente_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(ESTADOS_COTIZACION).optional(),
  soloVigentes: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
