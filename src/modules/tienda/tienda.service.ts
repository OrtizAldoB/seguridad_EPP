import { withImmediateTx } from '../../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors';
import { calcularTotales } from '../../shared/pricing';
import { getById as getPedido, crearPedidoTx } from '../pedidos/pedidos.service';
import { findProductoById, type ProductoRow } from '../productos/productos.repository';
import { findClienteIdByUsuarioId } from '../usuarios/usuarios.repository';
import * as repo from './tienda.repository';
import type { CarritoItem, PedidoPropio } from './tienda.repository';

export interface Carrito {
  items: CarritoItem[];
  cantidadItems: number;
  subtotal: number;
  descuentoMonto: number;
  impuestoMonto: number;
  total: number;
}

export interface CheckoutInput {
  condicionPago: 'CONTADO' | 'CREDITO';
  observacion?: string;
  diasEntrega: number;
}

function carritoActual(usuarioId: number): Carrito {
  const items = repo.listCarrito(usuarioId).map(repo.toCarritoItem);
  const totales = calcularTotales(
    items.map((item) => ({ cantidad: item.cantidad, precioUnitario: item.precioUnitario })),
  );
  return {
    items,
    cantidadItems: items.reduce((sum, item) => sum + item.cantidad, 0),
    ...totales,
  };
}

function validarProducto(productoId: number, cantidad: number): ProductoRow {
  const producto = findProductoById(productoId);
  if (!producto || producto.activo !== 1) throw new NotFoundError('El producto no esta disponible');
  if (cantidad > producto.stock_real - producto.stock_comprometido) {
    throw new ConflictError(`Stock insuficiente para ${producto.codigo}`);
  }
  return producto;
}

export function catalogo(q?: string, categoria?: string) {
  return { items: repo.listCatalogo(q, categoria), categorias: repo.catalogoCategorias() };
}

export function carrito(usuarioId: number): Carrito {
  return carritoActual(usuarioId);
}

export function agregarItem(usuarioId: number, productoId: number, cantidad: number): Carrito {
  withImmediateTx(() => {
    validarProducto(productoId, repo.findCantidad(usuarioId, productoId) + cantidad);
    repo.upsertItem(usuarioId, productoId, cantidad);
  });
  return carritoActual(usuarioId);
}

export function actualizarCantidad(usuarioId: number, productoId: number, cantidad: number): Carrito {
  withImmediateTx(() => {
    if (repo.findCantidad(usuarioId, productoId) === 0) throw new NotFoundError('El producto no esta en el carrito');
    validarProducto(productoId, cantidad);
    repo.setCantidad(usuarioId, productoId, cantidad);
  });
  return carritoActual(usuarioId);
}

export function eliminarItem(usuarioId: number, productoId: number): Carrito {
  repo.removeItem(usuarioId, productoId);
  return carritoActual(usuarioId);
}

export function vaciarCarrito(usuarioId: number): Carrito {
  repo.clearCarrito(usuarioId);
  return carritoActual(usuarioId);
}

export function checkout(usuarioId: number, input: CheckoutInput) {
  const clienteId = findClienteIdByUsuarioId(usuarioId);
  if (!clienteId) throw new BadRequestError('Tu cuenta no tiene un cliente asociado');

  return withImmediateTx(() => {
    const items = repo.listCarrito(usuarioId);
    if (items.length === 0) throw new BadRequestError('El carrito esta vacio');

    const pedido = crearPedidoTx(
      {
        cliente_id: clienteId,
        items: items.map((item) => ({ producto_id: item.producto_id, cantidad: item.cantidad })),
        condicion_pago: input.condicionPago,
        descuento_porcentaje: 0,
        dias_entrega: input.diasEntrega,
        observacion: input.observacion,
      },
      usuarioId,
    );
    repo.clearCarrito(usuarioId);
    return getPedido(pedido.id);
  });
}

export function misPedidos(usuarioId: number): PedidoPropio[] {
  const clienteId = findClienteIdByUsuarioId(usuarioId);
  if (!clienteId) return [];
  return repo.listMisPedidos(clienteId);
}

export function miPedido(usuarioId: number, id: number): PedidoPropio {
  const clienteId = findClienteIdByUsuarioId(usuarioId);
  if (!clienteId) throw new NotFoundError('Pedido no encontrado');
  const pedido = repo.findPedidoPropio(id, clienteId);
  if (!pedido) throw new NotFoundError('Pedido no encontrado');
  return pedido;
}
