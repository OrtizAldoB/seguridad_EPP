import { z } from 'zod';

export function fechaHoyIso(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

export function fechaMasDiasIso(dias: number): string {
  const ahora = new Date();
  const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export const fechaIsoSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido (YYYY-MM-DD)')
  .refine((valor) => {
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  }, 'Fecha invalida');

export const fechaNoPasadaSchema = fechaIsoSchema.refine(
  (valor) => valor >= fechaHoyIso(),
  'La fecha no puede ser anterior a hoy',
);
