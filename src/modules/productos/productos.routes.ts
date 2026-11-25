import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './productos.controller';
import {
  createProductoSchema,
  idParamSchema,
  listProductosQuerySchema,
  updateProductoSchema,
} from './productos.schema';

const router = Router();

router.use(authenticate);

router.get('/categorias', requirePermiso(PERMISOS.PRODUCTOS_LEER), controller.categorias);
router.get('/alertas', requirePermiso(PERMISOS.PRODUCTOS_LEER), controller.alertas);
router.get('/', validateQuery(listProductosQuerySchema), requirePermiso(PERMISOS.PRODUCTOS_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.PRODUCTOS_LEER), controller.getById);
router.post('/', validateBody(createProductoSchema), requirePermiso(PERMISOS.PRODUCTOS_CREAR), controller.create);
router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateProductoSchema),
  requirePermiso(PERMISOS.PRODUCTOS_ACTUALIZAR),
  controller.update,
);
router.delete('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.PRODUCTOS_ELIMINAR), controller.remove);

export default router;
