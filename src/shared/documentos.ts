import { z } from 'zod';

export const TIPOS_DOCUMENTO = ['NIT', 'CI'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const tipoDocumentoSchema = z.enum(TIPOS_DOCUMENTO);

export function esDocumentoValido(tipo: TipoDocumento, valor: string): boolean {
  const doc = valor.trim();
  if (tipo === 'NIT') return /^\d+$/.test(doc);
  return /^[A-Za-z0-9]+$/.test(doc);
}

export function mensajeDocumento(tipo: TipoDocumento): string {
  return tipo === 'NIT'
    ? 'El NIT solo debe contener números.'
    : 'La CI solo debe contener números y letras.';
}

export function documentoSchema(
  tipo: TipoDocumento = 'NIT',
): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .trim()
    .min(5)
    .max(30)
    .refine((valor) => esDocumentoValido(tipo, valor), mensajeDocumento(tipo));
}
