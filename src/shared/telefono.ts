import { z } from 'zod';

export const TELEFONO_MIN_DIGITOS = 7;
export const TELEFONO_MAX_DIGITOS = 15;

export function esTelefonoValido(valor: string): boolean {
  return new RegExp(`^\\d{${TELEFONO_MIN_DIGITOS},${TELEFONO_MAX_DIGITOS}}$`).test(valor.trim());
}

export const telefonoSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'El teléfono solo debe contener números')
  .refine(
    (valor) => valor.length >= TELEFONO_MIN_DIGITOS && valor.length <= TELEFONO_MAX_DIGITOS,
    `El teléfono debe tener entre ${TELEFONO_MIN_DIGITOS} y ${TELEFONO_MAX_DIGITOS} dígitos`,
  );

export const telefonoOpcionalSchema = z.union([z.literal(''), telefonoSchema]).optional();
