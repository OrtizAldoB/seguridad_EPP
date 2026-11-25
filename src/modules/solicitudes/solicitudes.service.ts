import { withImmediateTx } from '../../config/database';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { ROLES } from '../../shared/constants';
import * as comprasRepo from '../compras/compras.repository';
import * as proveedoresRepo from '../proveedores/proveedores.repository';
import * as usuariosRepo from '../usuarios/usuarios.repository';
import * as repo from './solicitudes.repository';
import type { Solicitud, SolicitudItem } from './solicitudes.repository';

export interface CreateSolicitudInput {
  proveedor_id: number;
  observacion?: string;
  items: { producto_id: number; cantidad: number }[];
}

export interface SolicitudDetallada extends Solicitud {
  items: SolicitudItem[];
}

export interface AprobacionResult {
  solicitud: SolicitudDetallada;
  compra: ReturnType<typeof comprasRepo.toCompra>;
}

function validarProveedor(proveedorId: number) {
  const proveedor = comprasRepo.findProveedorActivo(proveedorId);
  if (!proveedor) throw new NotFoundError('Proveedor no encontrado');
  if (proveedor.estado !== 'ACTIVO') throw new BadRequestError('El proveedor esta inactivo');
  return proveedor;
}

function validarItems(proveedorId: number, items: CreateSolicitudInput['items']): void {
  const vistos = new Set<number>();
  const proveedorTieneOfertas = proveedoresRepo.proveedorTieneOfertas(proveedorId);
  for (const item of items) {
    if (vistos.has(item.producto_id)) throw new BadRequestError('Producto duplicado en la solicitud');
    vistos.add(item.producto_id);
    const producto = comprasRepo.findProducto(item.producto_id);
    if (!producto) throw new NotFoundError(`Producto ${item.producto_id} no encontrado`);
    if (proveedorTieneOfertas) {
      const oferta = proveedoresRepo.findOfertaProveedor(proveedorId, item.producto_id);
      if (!oferta) throw new BadRequestError(`El producto ${producto.codigo} no es ofrecido por este proveedor`);
      if (item.cantidad < oferta.minimoCompra) {
        throw new BadRequestError(`La cantidad mínima de compra para ${producto.codigo} es ${oferta.minimoCompra}`);
      }
    }
  }
}

export function list(f: { q?: string; estado?: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'; proveedor_id?: number; page: number; limit: number }) {
  return repo.listSolicitudes(f);
}

export function getById(id: number): SolicitudDetallada {
  const row = repo.findSolicitudById(id);
  if (!row) throw new NotFoundError('Solicitud no encontrada');
  return { ...repo.toSolicitud(row), items: repo.listItems(id) };
}

export function create(input: CreateSolicitudInput, usuarioId: number): SolicitudDetallada {
  const usuario = usuariosRepo.findAuthUserById(usuarioId);
  if (!usuario || usuario.role !== ROLES.ALMACENERO) {
    throw new ForbiddenError('Solo el almacenero puede crear solicitudes de compra');
  }
  return withImmediateTx(() => {
    validarProveedor(input.proveedor_id);
    validarItems(input.proveedor_id, input.items);
    const solicitud = repo.createSolicitud({
      codigo: repo.nextCodigo(),
      proveedorId: input.proveedor_id,
      usuarioId,
      observacion: input.observacion,
    });
    for (const item of input.items) {
      repo.insertDetalle({ solicitudId: solicitud.id, productoId: item.producto_id, cantidad: item.cantidad });
    }
    return getById(solicitud.id);
  });
}

export function aprobar(id: number, usuarioId: number): AprobacionResult {
  return withImmediateTx(() => {
    const row = repo.findSolicitudById(id);
    if (!row) throw new NotFoundError('Solicitud no encontrada');
    if (row.estado !== 'PENDIENTE') throw new ConflictError('La solicitud ya fue decidida');

    validarProveedor(row.proveedor_id);
    const items = repo.listItems(id);
    if (!items.length) throw new BadRequestError('La solicitud no tiene productos');

    const proveedorTieneOfertas = proveedoresRepo.proveedorTieneOfertas(row.proveedor_id);
    let total = 0;
    const detalles: { productoId: number; cantidad: number; costoUnitario: number; subtotal: number }[] = [];
    for (const item of items) {
      const producto = comprasRepo.findProducto(item.productoId);
      if (!producto) throw new NotFoundError(`Producto ${item.productoId} no encontrado`);
      const oferta = proveedorTieneOfertas
        ? proveedoresRepo.findOfertaProveedor(row.proveedor_id, item.productoId)
        : undefined;
      if (proveedorTieneOfertas && !oferta) {
        throw new BadRequestError(`El producto ${producto.codigo} no es ofrecido por este proveedor`);
      }
      if (oferta && item.cantidad < oferta.minimoCompra) {
        throw new BadRequestError(`La cantidad mínima de compra para ${producto.codigo} es ${oferta.minimoCompra}`);
      }
      const costoUnitario = oferta?.precioUnitario ?? (producto.costo_unitario > 0 ? producto.costo_unitario : producto.precio_unitario);
      const subtotal = Number((item.cantidad * costoUnitario).toFixed(2));
      total += subtotal;
      detalles.push({ productoId: item.productoId, cantidad: item.cantidad, costoUnitario, subtotal });
    }

    const observacion = row.observacion
      ? `${row.observacion} (Solicitud ${row.codigo})`
      : `Generada desde solicitud ${row.codigo}`;
    const compraId = comprasRepo.createCompra({
      codigo: comprasRepo.nextCodigo(),
      proveedorId: row.proveedor_id,
      usuarioId,
      observacion,
      fechaEmision: new Date().toISOString().slice(0, 10),
      total: Number(total.toFixed(2)),
    });
    for (const detalle of detalles) comprasRepo.insertDetalle({ compraId, ...detalle });

    repo.updateDecision(id, 'APROBADA', { aprobadoPor: usuarioId, compraId });
    const compraRow = comprasRepo.findCompraById(compraId);
    return {
      solicitud: getById(id),
      compra: comprasRepo.toCompra(compraRow!),
    };
  });
}

export function rechazar(id: number, usuarioId: number, motivoRechazo?: string): SolicitudDetallada {
  return withImmediateTx(() => {
    const row = repo.findSolicitudById(id);
    if (!row) throw new NotFoundError('Solicitud no encontrada');
    if (row.estado !== 'PENDIENTE') throw new ConflictError('La solicitud ya fue decidida');
    repo.updateDecision(id, 'RECHAZADA', { aprobadoPor: usuarioId, motivoRechazo });
    return getById(id);
  });
}
