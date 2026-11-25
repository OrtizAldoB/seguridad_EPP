import { z } from 'zod';
import { ESTADOS_PEDIDO } from '../../shared/constants';

const itemPedidoSchema = z
  .object({
    producto_id: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().positive(),
    precio_unitario: z.number().min(0).optional(),
    descuento_porcentaje: z.number().min(0).max(100).optional(),
  })
  .strict();

export const crearPedidoSchema = z
  .object({
    cliente_id: z.coerce.number().int().positive(),
    items: z.array(itemPedidoSchema).min(1),
    condicion_pago: z.enum(['CONTADO', 'CREDITO']),
    descuento_porcentaje: z.number().min(0).max(100).default(0),
    plazo_meses: z.number().int().min(0).max(12).default(0),
    dias_entrega: z.number().int().min(1).max(90).default(3),
    observacion: z.string().trim().max(500).optional(),
    cotizacion_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const cambiarEstadoSchema = z
  .object({
    estado: z.enum(ESTADOS_PEDIDO),
  })
  .strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listPedidosQuerySchema = z.object({
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  cliente_id: z.coerce.number().int().positive().optional(),
  vendedor_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
