import { z } from 'zod';

export const ESTADOS_SOLICITUD = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

const itemSchema = z
  .object({
    producto_id: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().positive(),
  })
  .strict();

export const createSolicitudSchema = z
  .object({
    proveedor_id: z.coerce.number().int().positive(),
    observacion: z.string().trim().max(500).optional(),
    items: z.array(itemSchema).min(1),
  })
  .strict();

export const decisionSolicitudSchema = z
  .object({
    motivo_rechazo: z.string().trim().max(500).optional(),
  })
  .strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();

export const listSolicitudesQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    estado: z.enum(ESTADOS_SOLICITUD).optional(),
    proveedor_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
