import { IVA_PORCENTAJE, TASA_INTERES_MENSUAL } from './constants';

export interface LineaCalculo {
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentaje?: number;
}

export interface TotalesCalculo {
  subtotal: number;
  descuentoMonto: number;
  impuestoMonto: number;
  interesMonto: number;
  total: number;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calcularTotales(
  lineas: LineaCalculo[],
  descuentoPorcentaje = 0,
  plazoMeses = 0,
): TotalesCalculo {
  const subtotal = round2(
    lineas.reduce(
      (sum, linea) => sum + linea.cantidad * linea.precioUnitario * (1 - (linea.descuentoPorcentaje ?? 0) / 100),
      0,
    ),
  );
  const descuentoMonto = round2(subtotal * (descuentoPorcentaje / 100));
  const base = round2(subtotal - descuentoMonto);
  const impuestoMonto = round2(base * (IVA_PORCENTAJE / 100));
  const baseConImpuesto = round2(base + impuestoMonto);
  const interesMonto = plazoMeses > 0
    ? round2(baseConImpuesto * (TASA_INTERES_MENSUAL / 100) * plazoMeses)
    : 0;
  return {
    subtotal,
    descuentoMonto,
    impuestoMonto,
    interesMonto,
    total: round2(baseConImpuesto + interesMonto),
  };
}
