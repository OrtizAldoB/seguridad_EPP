import { z } from 'zod';

export function esNombreValido(valor: string): boolean {
  const texto = valor.trim();
  if (/\d/.test(texto)) return false;
  if (!/^[\p{L}][\p{L}\s'.\-]*$/u.test(texto)) return false;
  return texto.replace(/[^\p{L}]/gu, '').length >= 2;
}

const mensaje = 'El nombre solo debe contener letras, espacios, puntos, apóstrofos o guiones, sin números';

export const nombrePersonaSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .refine(esNombreValido, mensaje);

export const razonSocialSchema = z
  .string()
  .trim()
  .min(2)
  .max(150)
  .refine(esNombreValido, mensaje);
