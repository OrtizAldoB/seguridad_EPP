import { z } from 'zod';
import { esDocumentoValido, mensajeDocumento, tipoDocumentoSchema, TIPOS_DOCUMENTO } from '../../shared/documentos';
import { razonSocialSchema } from '../../shared/nombres';
import { telefonoOpcionalSchema } from '../../shared/telefono';

export const ESTADOS_CLIENTE = ['ACTIVO', 'INACTIVO'] as const;

export type EstadoCliente = (typeof ESTADOS_CLIENTE)[number];

const razonSocial = razonSocialSchema;
const nitCi = z.string().trim().min(5).max(30);
const tipoDocumento = z.enum(TIPOS_DOCUMENTO).default('NIT');
const email = z.string().trim().email().max(120).transform((value) => value.toLowerCase());
const emailOpcional = z
  .union([z.literal(''), email])
  .optional()
  .transform((value) => value || undefined);
const direccion = z.string().trim().max(255);
const direccionOpcional = direccion.optional().transform((value) => value || undefined);
const telefono = telefonoOpcionalSchema.transform((value) => value || undefined);
const estado = z.enum(ESTADOS_CLIENTE);

export const createClienteSchema = z
  .object({
    razonSocial,
    nitCi,
    tipoDocumento,
    telefono,
    email: emailOpcional,
    direccion: direccionOpcional,
    estado: estado.default('ACTIVO'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!esDocumentoValido(value.tipoDocumento, value.nitCi)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nitCi'], message: mensajeDocumento(value.tipoDocumento) });
    }
  });

export const updateClienteSchema = z
  .object({
    razonSocial: razonSocial.optional(),
    nitCi: nitCi.optional(),
    tipoDocumento: tipoDocumentoSchema.optional(),
    telefono,
    email: emailOpcional,
    direccion: direccionOpcional,
    estado: estado.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo')
  .superRefine((value, ctx) => {
    if (value.nitCi !== undefined && !esDocumentoValido(value.tipoDocumento ?? 'NIT', value.nitCi)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nitCi'],
        message: mensajeDocumento(value.tipoDocumento ?? 'NIT'),
      });
    }
  });

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() }).strict();

export const listClientesQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    estado: estado.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
