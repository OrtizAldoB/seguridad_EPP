import { z } from 'zod';

export const PERIODOS = ['diario', 'semanal', 'mensual', 'personalizado'] as const;
export const TIPOS_EXPORTACION = ['ventas', 'cotizaciones', 'kardex'] as const;

const periodo = z.enum(PERIODOS).default('mensual');

const fecha = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido (YYYY-MM-DD)')
  .refine((valor) => {
    const [anio, mes, dia] = valor.split('-').map(Number);
    const candidata = new Date(Date.UTC(anio, mes - 1, dia));
    return candidata.getUTCFullYear() === anio && candidata.getUTCMonth() === mes - 1 && candidata.getUTCDate() === dia;
  }, 'Fecha invalida');

interface RangoInput {
  periodo: (typeof PERIODOS)[number];
  desde?: string;
  hasta?: string;
}

function rangoValido(valor: RangoInput): boolean {
  if (valor.periodo === 'personalizado') {
    return valor.desde !== undefined && valor.hasta !== undefined && valor.desde <= valor.hasta;
  }
  return valor.desde === undefined || valor.hasta === undefined || valor.desde <= valor.hasta;
}

const mensajeRango = 'Para periodo personalizado desde y hasta son obligatorios, y desde no puede ser mayor que hasta';

const baseQuery = z.object({ periodo, desde: fecha.optional(), hasta: fecha.optional() });

export const reporteQuerySchema = baseQuery.strict().refine(rangoValido, {
  message: mensajeRango,
  path: ['desde'],
});

export const topQuerySchema = baseQuery
  .extend({ limit: z.coerce.number().int().min(1).max(20).default(5) })
  .strict()
  .refine(rangoValido, { message: mensajeRango, path: ['desde'] });

export const exportQuerySchema = baseQuery
  .extend({ tipo: z.enum(TIPOS_EXPORTACION) })
  .strict()
  .refine(rangoValido, { message: mensajeRango, path: ['desde'] });

export type Periodo = (typeof PERIODOS)[number];
export type TipoExportacion = (typeof TIPOS_EXPORTACION)[number];
export type ReporteQuery = z.infer<typeof reporteQuerySchema>;
export type TopQuery = z.infer<typeof topQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
