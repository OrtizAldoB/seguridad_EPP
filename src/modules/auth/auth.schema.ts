import { z } from 'zod';
import { esDocumentoValido, mensajeDocumento, tipoDocumentoSchema } from '../../shared/documentos';
import { nombrePersonaSchema } from '../../shared/nombres';
import { telefonoOpcionalSchema } from '../../shared/telefono';

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(32).max(256),
  })
  .strict();

export const registroSchema = z
  .object({
    nombreCompleto: nombrePersonaSchema,
    email: z.string().trim().email().max(120).transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8)
      .max(72)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Debe incluir mayuscula, minuscula y numero'),
    nitCi: z.string().trim().min(5).max(30),
    tipoDocumento: tipoDocumentoSchema.default('NIT'),
    telefono: telefonoOpcionalSchema,
    direccion: z.string().trim().max(255).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!esDocumentoValido(value.tipoDocumento, value.nitCi)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nitCi'], message: mensajeDocumento(value.tipoDocumento) });
    }
  });
