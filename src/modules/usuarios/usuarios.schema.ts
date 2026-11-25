import { z } from 'zod';
import { ROLES } from '../../shared/constants';
import { esDocumentoValido, mensajeDocumento, tipoDocumentoSchema } from '../../shared/documentos';
import { nombrePersonaSchema } from '../../shared/nombres';
import { telefonoOpcionalSchema } from '../../shared/telefono';

const nombreCompleto = nombrePersonaSchema;
const email = z.string().trim().email().max(120).transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(8)
  .max(72)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Debe incluir mayuscula, minuscula y numero');
const rolId = z.coerce.number().int().positive();

export const createUsuarioSchema = z
  .object({
    nombreCompleto,
    email,
    password,
    rolId,
    activo: z.boolean().default(true),
    nitCi: z.string().trim().min(5).max(30).optional(),
    tipoDocumento: tipoDocumentoSchema.optional(),
    telefono: telefonoOpcionalSchema,
    direccion: z.string().trim().max(255).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.nitCi !== undefined && !esDocumentoValido(value.tipoDocumento ?? 'NIT', value.nitCi)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nitCi'],
        message: mensajeDocumento(value.tipoDocumento ?? 'NIT'),
      });
    }
  });

export const updateUsuarioSchema = z
  .object({
    nombreCompleto: nombreCompleto.optional(),
    email: email.optional(),
    rolId: rolId.optional(),
    activo: z.boolean().optional(),
    nitCi: z.string().trim().min(5).max(30).optional(),
    tipoDocumento: tipoDocumentoSchema.optional(),
    telefono: telefonoOpcionalSchema,
    direccion: z.string().trim().max(255).optional(),
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

export const updateEstadoSchema = z.object({ activo: z.boolean() }).strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();

export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const listUsuariosQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum([ROLES.ADMINISTRADOR, ROLES.VENDEDOR, ROLES.ALMACENERO, ROLES.COMPRADOR]).optional(),
  activo: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true' || value === '1')),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
