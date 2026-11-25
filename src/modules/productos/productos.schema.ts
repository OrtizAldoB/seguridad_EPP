import { z } from 'zod';
import { CATEGORIAS_EPP } from '../../shared/constants';

const codigo = z.string().trim().min(1).max(50);
const nombre = z.string().trim().min(2).max(150);
const categoria = z.enum(CATEGORIAS_EPP);
const unidadMedida = z.string().trim().min(1).max(20).default('UND');
const descripcion = z.string().trim().max(500);
const precioUnitario = z.number().finite().nonnegative();
const stockReal = z.number().int().nonnegative();
const stockComprometido = z.number().int().nonnegative().default(0);
const stockMinimo = z.number().int().nonnegative().default(0);
const descuentoPorcentaje = z.number().min(0).max(100).default(0);
const proveedorId = z.coerce.number().int().positive().nullable();

export const createProductoSchema = z
  .object({
    codigo,
    nombre,
    categoria,
    unidadMedida: unidadMedida.optional(),
    descripcion: descripcion.optional(),
    precioUnitario,
    stockReal,
    stockComprometido: stockComprometido.optional(),
    stockMinimo: stockMinimo.optional(),
    proveedorId: proveedorId.optional(),
    descuentoPorcentaje: descuentoPorcentaje.optional(),
    activo: z.boolean().default(true),
  })
  .strict()
  .refine((value) => (value.stockComprometido ?? 0) <= value.stockReal, {
    message: 'stock_comprometido no puede superar stock_real',
    path: ['stockComprometido'],
  });

export const updateProductoSchema = z
  .object({
    codigo: codigo.optional(),
    nombre: nombre.optional(),
    categoria: categoria.optional(),
    unidadMedida: z.string().trim().min(1).max(20).optional(),
    descripcion: descripcion.optional(),
    precioUnitario: precioUnitario.optional(),
    stockReal: z.number().int().nonnegative().optional(),
    stockComprometido: z.number().int().nonnegative().optional(),
    stockMinimo: z.number().int().nonnegative().optional(),
    proveedorId: proveedorId.optional(),
    descuentoPorcentaje: descuentoPorcentaje.optional(),
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();

export const listProductosQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    categoria: z.string().trim().max(80).optional(),
    activo: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true' || value === '1')),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
