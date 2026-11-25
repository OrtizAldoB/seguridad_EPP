import { withImmediateTx } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors';
import * as proveedoresRepo from '../proveedores/proveedores.repository';
import * as repo from './compras.repository';
import type { Compra, CompraDetalle } from './compras.repository';

export interface CompraItemInput { producto_id: number; cantidad: number; costo_unitario: number; }
export interface CreateCompraInput { proveedor_id: number; observacion?: string; fecha_emision?: string; items: CompraItemInput[]; }
export interface CompraDetallada extends Compra { detalles: CompraDetalle[]; }

export function list(f: { q?: string; estado?: 'REGISTRADA'|'RECIBIDA'|'CANCELADA'; proveedor_id?: number; page: number; limit: number }) { return repo.listCompras(f); }

export function getById(id: number): CompraDetallada {
  const row = repo.findCompraById(id); if (!row) throw new NotFoundError('Compra no encontrada');
  return { ...repo.toCompra(row), detalles: repo.listDetalles(id) };
}

export function create(input: CreateCompraInput, usuarioId: number): CompraDetallada {
  return withImmediateTx(() => {
    const proveedor = repo.findProveedorActivo(input.proveedor_id);
    if (!proveedor) throw new NotFoundError('Proveedor no encontrado');
    if (proveedor.estado !== 'ACTIVO') throw new BadRequestError('El proveedor esta inactivo');

    const seen = new Set<number>();
    const proveedorTieneOfertas = proveedoresRepo.proveedorTieneOfertas(input.proveedor_id);
    let total = 0;
    const items = input.items.map((it) => {
      if (seen.has(it.producto_id)) throw new BadRequestError('Producto duplicado en la compra');
      seen.add(it.producto_id);
      const prod = repo.findProducto(it.producto_id);
      if (!prod) throw new NotFoundError(`Producto ${it.producto_id} no encontrado`);
      if (proveedorTieneOfertas) {
        const oferta = proveedoresRepo.findOfertaProveedor(input.proveedor_id, it.producto_id);
        if (!oferta) throw new BadRequestError(`El producto ${prod.codigo} no es ofrecido por este proveedor`);
        if (it.cantidad < oferta.minimoCompra) {
          throw new BadRequestError(`La cantidad mínima de compra para ${prod.codigo} es ${oferta.minimoCompra}`);
        }
      }
      const subtotal = Number((it.cantidad * it.costo_unitario).toFixed(2));
      total += subtotal;
      return { ...it, subtotal };
    });

    const codigo = repo.nextCodigo();
    const fecha = input.fecha_emision ?? new Date().toISOString().slice(0, 10);
    const compraId = repo.createCompra({ codigo, proveedorId: input.proveedor_id, usuarioId, observacion: input.observacion, fechaEmision: fecha, total: Number(total.toFixed(2)) });
    for (const it of items) repo.insertDetalle({ compraId, productoId: it.producto_id, cantidad: it.cantidad, costoUnitario: it.costo_unitario, subtotal: it.subtotal });
    return getById(compraId);
  });
}

export function recibir(id: number, usuarioId: number): CompraDetallada {
  return withImmediateTx(() => {
    const row = repo.findCompraById(id); if (!row) throw new NotFoundError('Compra no encontrada');
    if (row.estado === 'RECIBIDA') throw new ConflictError('La compra ya fue recibida');
    if (row.estado === 'CANCELADA') throw new ConflictError('La compra esta cancelada');

    const detalles = repo.listDetalles(id);
    for (const det of detalles) {
      const stock = repo.stockProducto(det.productoId);
      if (!stock) throw new NotFoundError(`Producto ${det.productoId} no encontrado`);
      const stockAnterior = stock.stock_real;
      const stockNuevo = stockAnterior + det.cantidad;
      repo.aplicarEntradaStock(det.productoId, det.cantidad, stockAnterior);
      repo.insertKardex({ productoId: det.productoId, cantidad: det.cantidad, stockAnterior, stockNuevo, referencia: row.codigo, observacion: `Recepcion de compra ${row.codigo}`, usuarioId, costoUnitario: det.costoUnitario });
    }
    repo.updateCompraEstado(id, 'RECIBIDA', new Date().toISOString());
    return getById(id);
  });
}

export function cancelar(id: number): CompraDetallada {
  return withImmediateTx(() => {
    const row = repo.findCompraById(id); if (!row) throw new NotFoundError('Compra no encontrada');
    if (row.estado === 'RECIBIDA') throw new ConflictError('No se puede cancelar una compra recibida');
    if (row.estado === 'CANCELADA') return getById(id);
    repo.updateCompraEstado(id, 'CANCELADA', null);
    return getById(id);
  });
}
