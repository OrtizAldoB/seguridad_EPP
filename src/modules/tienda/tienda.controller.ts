import type { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { created, ok } from '../../shared/response';
import type {
  catalogoQuerySchema,
  cantidadSchema,
  checkoutSchema,
  itemCarritoSchema,
} from './tienda.schema';
import * as service from './tienda.service';

export const catalogo = asyncHandler(async (req, res) => {
  const { q, categoria } = req.query as z.infer<typeof catalogoQuerySchema>;
  ok(res, service.catalogo(q, categoria));
});

export const carrito = asyncHandler(async (req, res) => {
  ok(res, service.carrito(req.user!.id));
});

export const agregarItem = asyncHandler(async (req, res) => {
  const { productoId, cantidad } = req.body as z.infer<typeof itemCarritoSchema>;
  created(res, service.agregarItem(req.user!.id, productoId, cantidad), 'Producto agregado al carrito');
});

export const actualizarCantidad = asyncHandler(async (req, res) => {
  const { cantidad } = req.body as z.infer<typeof cantidadSchema>;
  ok(
    res,
    service.actualizarCantidad(req.user!.id, Number(req.params.productoId), cantidad),
    { message: 'Cantidad actualizada' },
  );
});

export const eliminarItem = asyncHandler(async (req, res) => {
  ok(res, service.eliminarItem(req.user!.id, Number(req.params.productoId)), { message: 'Producto eliminado' });
});

export const vaciarCarrito = asyncHandler(async (req, res) => {
  ok(res, service.vaciarCarrito(req.user!.id), { message: 'Carrito vaciado' });
});

export const checkout = asyncHandler(async (req, res) => {
  created(res, service.checkout(req.user!.id, req.body as z.infer<typeof checkoutSchema>), 'Pedido registrado');
});

export const misPedidos = asyncHandler(async (req, res) => {
  ok(res, service.misPedidos(req.user!.id));
});

export const miPedido = asyncHandler(async (req, res) => {
  ok(res, service.miPedido(req.user!.id, Number(req.params.id)));
});
