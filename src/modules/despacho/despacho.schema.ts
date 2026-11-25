import { z } from 'zod';

export const pedidoIdParamSchema = z.object({ pedidoId: z.coerce.number().int().positive() }).strict();

export type PedidoIdParam = z.infer<typeof pedidoIdParamSchema>;
