import { db, withImmediateTx } from '../../config/database';
import { DESCUENTO_MAXIMO_SIN_APROBACION, DIAS_POR_MES, DIAS_VIGENCIA_COTIZACION } from '../../shared/constants';
import { fechaHoyIso, fechaMasDiasIso } from '../../shared/fechas';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors';
import { calcularTotales, round2 } from '../../shared/pricing';
import { crearPedidoTx, type CrearPedidoInput } from '../pedidos/pedidos.service';
import type { PedidoRow } from '../pedidos/pedidos.repository';
import * as repo from './cotizaciones.repository';
import type {
  CotizacionDetalleRow,
  CotizacionRow,
  ListCotizacionesFilters,
} from './cotizaciones.repository';

export interface ItemCotizacionInput {
  producto_id: number;
  cantidad: number;
  precio_unitario?: number;
  descuento_porcentaje?: number;
}

export interface CrearCotizacionInput {
  cliente_id: number;
  items: ItemCotizacionInput[];
  condicion_pago: 'CONTADO' | 'CREDITO';
  descuento_porcentaje?: number;
  plazo_meses?: number;
  observacion?: string;
}

export interface ActualizarCotizacionInput {
  items?: ItemCotizacionInput[];
  condicion_pago?: 'CONTADO' | 'CREDITO';
  descuento_porcentaje?: number;
  plazo_meses?: number;
  observacion?: string;
}

function validarDescuentoCredito(
  condicion: 'CONTADO' | 'CREDITO',
  descuento: number,
  lineas: Pick<LineaPreparada, 'descuento'>[],
): void {
  if (condicion === 'CREDITO' && (descuento > 0 || lineas.some((linea) => linea.descuento > 0))) {
    throw new BadRequestError('No se permiten descuentos en ventas al crédito');
  }
}

export interface CotizacionDetallada extends CotizacionRow {
  items: CotizacionDetalleRow[];
  vigente: boolean;
  diasRestantes: number;
}

interface LineaPreparada {
  producto_id: number;
  cantidad: number;
  precio: number;
  descuento: number;
  codigo: string;
}

function prepararLineas(items: ItemCotizacionInput[]): LineaPreparada[] {
  if (!items.length) throw new BadRequestError('La cotizacion debe incluir al menos un item');
  const mapa = new Map<number, ItemCotizacionInput>();
  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new BadRequestError('Las cantidades deben ser enteros positivos');
    }
    const actual = mapa.get(item.producto_id);
    if (actual) actual.cantidad += item.cantidad;
    else mapa.set(item.producto_id, { ...item });
  }

  return [...mapa.values()].map((item) => {
    const producto = repo.findProductoDisponible(item.producto_id);
    if (!producto || producto.activo !== 1) throw new NotFoundError(`Producto ${item.producto_id} no disponible`);
    if (producto.stock_real - producto.stock_comprometido < item.cantidad) {
      throw new ConflictError(`Stock insuficiente para ${producto.codigo}`);
    }
    const precio = item.precio_unitario ?? producto.precio_unitario;
    if (precio < 0) throw new BadRequestError('El precio unitario no puede ser negativo');
    return {
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio,
      descuento: item.descuento_porcentaje ?? 0,
      codigo: producto.codigo,
    };
  });
}

export function expire(): void {
  repo.expireCotizaciones();
}

export function list(filters: ListCotizacionesFilters): { items: CotizacionRow[]; total: number } {
  expire();
  return repo.listCotizaciones(filters);
}

export function getById(id: number): CotizacionDetallada {
  expire();
  const cotizacion = repo.findCotizacionById(id);
  if (!cotizacion) throw new NotFoundError('Cotizacion no encontrada');
  const restante = new Date(`${cotizacion.fecha_vencimiento}T23:59:59`).getTime() - Date.now();
  return {
    ...cotizacion,
    items: repo.findDetallesByCotizacionId(id),
    vigente: restante > 0 && !['VENCIDA', 'CONVERTIDA', 'RECHAZADA'].includes(cotizacion.estado),
    diasRestantes: Math.max(0, Math.ceil(restante / 86_400_000)),
  };
}

export function create(input: CrearCotizacionInput, vendedorId: number): CotizacionDetallada {
  return withImmediateTx(() => {
    const cliente = db.prepare('SELECT id, estado FROM clientes WHERE id = ?').get(input.cliente_id) as
      | { id: number; estado: string }
      | undefined;
    if (!cliente || cliente.estado !== 'ACTIVO') throw new NotFoundError('Cliente no encontrado o inactivo');

    const lineas = prepararLineas(input.items);
    const descuento = input.descuento_porcentaje ?? 0;
    validarDescuentoCredito(input.condicion_pago, descuento, lineas);
    const plazoMeses = input.condicion_pago === 'CREDITO' ? input.plazo_meses || 1 : 0;
    const totales = calcularTotales(
      lineas.map((linea) => ({
        cantidad: linea.cantidad,
        precioUnitario: linea.precio,
        descuentoPorcentaje: linea.descuento,
      })),
      descuento,
      plazoMeses,
    );
    const fechaVencimiento = fechaMasDiasIso(DIAS_VIGENCIA_COTIZACION);
    const requiere = descuento > DESCUENTO_MAXIMO_SIN_APROBACION || input.condicion_pago === 'CREDITO' ? 1 : 0;

    const id = repo.insertCotizacion({
      codigo: repo.nextCodigo(),
      clienteId: input.cliente_id,
      vendedorId,
      subtotal: totales.subtotal,
      descuentoPorcentaje: descuento,
      descuentoMonto: totales.descuentoMonto,
      impuestoMonto: totales.impuestoMonto,
      total: totales.total,
      plazoMeses,
      interesMonto: totales.interesMonto,
      fechaLimitePago: plazoMeses > 0 ? fechaMasDiasIso(plazoMeses * DIAS_POR_MES) : null,
      condicionPago: input.condicion_pago,
      requiereAprobacion: requiere,
      estado: 'ENVIADA',
      observacion: input.observacion ?? null,
      fechaVencimiento,
    });

    for (const linea of lineas) {
      repo.insertDetalle({
        cotizacionId: id,
        productoId: linea.producto_id,
        cantidad: linea.cantidad,
        precioUnitario: linea.precio,
        descuentoPorcentaje: linea.descuento,
        subtotal: round2(linea.cantidad * linea.precio * (1 - linea.descuento / 100)),
      });
    }

    return getById(id);
  });
}

export function update(id: number, input: ActualizarCotizacionInput): CotizacionDetallada {
  return withImmediateTx(() => {
    expire();
    const actual = repo.findCotizacionById(id);
    if (!actual) throw new NotFoundError('Cotizacion no encontrada');
    if (['VENCIDA', 'CONVERTIDA', 'RECHAZADA'].includes(actual.estado)) {
      throw new ConflictError(`No se puede editar una cotizacion ${actual.estado}`);
    }

    let lineas: LineaPreparada[];
    if (input.items) {
      lineas = prepararLineas(input.items);
      repo.replaceDetalles(id);
      for (const linea of lineas) {
        repo.insertDetalle({
          cotizacionId: id,
          productoId: linea.producto_id,
          cantidad: linea.cantidad,
          precioUnitario: linea.precio,
          descuentoPorcentaje: linea.descuento,
          subtotal: round2(linea.cantidad * linea.precio * (1 - linea.descuento / 100)),
        });
      }
    } else {
      const detalles = repo.findDetallesByCotizacionId(id);
      lineas = detalles.map((detalle) => ({
        producto_id: detalle.producto_id,
        cantidad: detalle.cantidad,
        precio: detalle.precio_unitario,
        descuento: detalle.descuento_porcentaje,
        codigo: detalle.codigo ?? '',
      }));
    }

    const descuento = input.descuento_porcentaje ?? actual.descuento_porcentaje;
    const condicion = input.condicion_pago ?? (actual.condicion_pago as 'CONTADO' | 'CREDITO');
    validarDescuentoCredito(condicion, descuento, lineas);
    const plazoMeses = condicion === 'CREDITO' ? input.plazo_meses || actual.plazo_meses || 1 : 0;
    const totales = calcularTotales(
      lineas.map((linea) => ({
        cantidad: linea.cantidad,
        precioUnitario: linea.precio,
        descuentoPorcentaje: linea.descuento,
      })),
      descuento,
      plazoMeses,
    );

    repo.updateCotizacion(id, {
      subtotal: totales.subtotal,
      descuentoPorcentaje: descuento,
      descuentoMonto: totales.descuentoMonto,
      impuestoMonto: totales.impuestoMonto,
      total: totales.total,
      plazoMeses,
      interesMonto: totales.interesMonto,
      fechaLimitePago: plazoMeses > 0 ? fechaMasDiasIso(plazoMeses * DIAS_POR_MES) : null,
      condicionPago: condicion,
      requiereAprobacion: descuento > DESCUENTO_MAXIMO_SIN_APROBACION || condicion === 'CREDITO' ? 1 : 0,
      observacion: input.observacion ?? actual.observacion,
    });

    if (descuento > DESCUENTO_MAXIMO_SIN_APROBACION || condicion === 'CREDITO') {
      repo.setEstado(id, 'ENVIADA');
    }

    return getById(id);
  });
}

export function aceptar(id: number): CotizacionDetallada {
  expire();
  const cotizacion = repo.findCotizacionById(id);
  if (!cotizacion) throw new NotFoundError('Cotizacion no encontrada');
  if (!['ENVIADA', 'BORRADOR'].includes(cotizacion.estado)) {
    throw new ConflictError(`No se puede aceptar una cotizacion ${cotizacion.estado}`);
  }
  repo.setEstado(id, 'ACEPTADA');
  return getById(id);
}

export function rechazar(id: number): CotizacionDetallada {
  expire();
  const cotizacion = repo.findCotizacionById(id);
  if (!cotizacion) throw new NotFoundError('Cotizacion no encontrada');
  if (['VENCIDA', 'CONVERTIDA'].includes(cotizacion.estado)) {
    throw new ConflictError(`No se puede rechazar una cotizacion ${cotizacion.estado}`);
  }
  repo.setEstado(id, 'RECHAZADA');
  return getById(id);
}

export function convertir(id: number, usuarioId: number): PedidoRow {
  return withImmediateTx(() => {
    expire();
    const cotizacion = repo.findCotizacionById(id);
    if (!cotizacion) throw new NotFoundError('Cotizacion no encontrada');
    if (cotizacion.estado === 'CONVERTIDA') throw new ConflictError('La cotizacion ya fue convertida');
    if (cotizacion.estado !== 'ACEPTADA') throw new ConflictError('La cotizacion debe estar ACEPTADA');
    if (cotizacion.fecha_vencimiento < fechaHoyIso()) {
      throw new ConflictError('La cotizacion esta vencida');
    }
    if (cotizacion.requiere_aprobacion === 1 && !cotizacion.aprobada_en) {
      throw new ConflictError('La cotizacion requiere aprobacion administrativa');
    }

    const detalles = repo.findDetallesByCotizacionId(id);
    if (!detalles.length) throw new ConflictError('La cotizacion no tiene items');

    const input: CrearPedidoInput = {
      cliente_id: cotizacion.cliente_id,
      items: detalles.map((detalle) => ({
        producto_id: detalle.producto_id,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        descuento_porcentaje: detalle.descuento_porcentaje,
      })),
      condicion_pago: cotizacion.condicion_pago as 'CONTADO' | 'CREDITO',
      descuento_porcentaje: cotizacion.descuento_porcentaje,
      plazo_meses: cotizacion.plazo_meses,
      dias_entrega: 3,
      observacion: `Convertida de ${cotizacion.codigo}`,
      cotizacion_id: id,
      omitirAprobacion: true,
    };

    const pedido = crearPedidoTx(input, usuarioId);
    repo.setEstado(id, 'CONVERTIDA');
    return pedido;
  });
}
