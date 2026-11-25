import { z } from 'zod';
import { CATEGORIAS_EPP } from '../../shared/constants';
import { razonSocialSchema } from '../../shared/nombres';
import { telefonoOpcionalSchema } from '../../shared/telefono';

export const ESTADOS_PROVEEDOR = ['ACTIVO', 'INACTIVO'] as const;
export type EstadoProveedor = (typeof ESTADOS_PROVEEDOR)[number];

const razonSocial = razonSocialSchema;
const nitCi = z.string().trim().min(5).max(30);

const productoNuevoSchema = z
  .object({
    codigo: z.string().trim().min(1).max(50),
    nombre: z.string().trim().min(2).max(150),
    categoria: z.enum(CATEGORIAS_EPP),
    unidadMedida: z.string().trim().min(1).max(20).default('UND'),
    descripcion: z.string().trim().max(500).optional(),
  })
  .strict();

export const proveedorProductoSchema = z
  .object({
    productoId: z.coerce.number().int().positive().optional(),
    productoNuevo: productoNuevoSchema.optional(),
    precioUnitario: z.coerce.number().finite().nonnegative(),
    minimoCompra: z.coerce.number().int().positive(),
  })
  .strict()
  .refine((value) => Boolean(value.productoId) !== Boolean(value.productoNuevo), {
    message: 'Selecciona un producto existente o registra uno nuevo',
  });

const email = z.string().trim().email().max(120).transform((v) => v.toLowerCase());
const direccion = z.string().trim().max(255);

const tieneTelefono = (valor: { telefono?: string; contacto?: string }): boolean =>
  Boolean(valor.telefono && valor.telefono.trim()) || Boolean(valor.contacto && valor.contacto.trim());

export const createProveedorSchema = z
  .object({
    razonSocial,
    nitCi,
    telefono: telefonoOpcionalSchema,
    email: email.optional(),
    direccion: direccion.optional(),
    contacto: telefonoOpcionalSchema,
    estado: z.enum(ESTADOS_PROVEEDOR).default('ACTIVO'),
    productos: z.array(proveedorProductoSchema).default([]),
  })
  .strict()
  .refine(tieneTelefono, {
    message: 'Registra un celular, un teléfono o ambos para continuar',
    path: ['telefono'],
  });

export const updateProveedorSchema = z
  .object({
    razonSocial: razonSocial.optional(),
    nitCi: nitCi.optional(),
    telefono: telefonoOpcionalSchema,
    email: email.optional(),
    direccion: direccion.optional(),
    contacto: telefonoOpcionalSchema,
    estado: z.enum(ESTADOS_PROVEEDOR).optional(),
    productos: z.array(proveedorProductoSchema).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Debe enviar al menos un campo')
  .refine((v) => (v.telefono === undefined && v.contacto === undefined) || tieneTelefono(v), {
    message: 'Registra un celular, un teléfono o ambos para continuar',
    path: ['telefono'],
  });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
export const listProveedoresQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  estado: z.enum(ESTADOS_PROVEEDOR).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
