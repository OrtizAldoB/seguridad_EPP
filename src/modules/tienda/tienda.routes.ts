import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './tienda.controller';
import {
  catalogoQuerySchema,
  cantidadSchema,
  checkoutSchema,
  idParamSchema,
  itemCarritoSchema,
  productoParamSchema,
} from './tienda.schema';

const router = Router();

router.use(authenticate, requirePermiso(PERMISOS.TIENDA_COMPRAR));

router.get('/catalogo', validateQuery(catalogoQuerySchema), controller.catalogo);

router.get('/carrito', controller.carrito);
router.post('/carrito/items', validateBody(itemCarritoSchema), controller.agregarItem);
router.patch(
  '/carrito/items/:productoId',
  validateParams(productoParamSchema),
  validateBody(cantidadSchema),
  controller.actualizarCantidad,
);
router.delete('/carrito/items/:productoId', validateParams(productoParamSchema), controller.eliminarItem);
router.delete('/carrito', controller.vaciarCarrito);

router.post('/checkout', validateBody(checkoutSchema), controller.checkout);

router.get('/mis-pedidos', requirePermiso(PERMISOS.TIENDA_PEDIDOS_PROPIOS), controller.misPedidos);
router.get(
  '/mis-pedidos/:id',
  validateParams(idParamSchema),
  requirePermiso(PERMISOS.TIENDA_PEDIDOS_PROPIOS),
  controller.miPedido,
);

export default router;
