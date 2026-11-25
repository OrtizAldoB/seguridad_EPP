export type Semaforo = 'ROJO' | 'AMARILLO' | 'VERDE';

export function calcularSemaforo(stockReal: number, stockComprometido: number, stockMinimo: number): Semaforo {
  const disponible = stockReal - stockComprometido;
  if (disponible <= stockMinimo) return 'ROJO';
  if (disponible <= stockMinimo * 1.25) return 'AMARILLO';
  return 'VERDE';
}
