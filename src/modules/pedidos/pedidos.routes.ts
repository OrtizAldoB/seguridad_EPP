import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso, requireRole } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS, ROLES } from '../../shared/constants';
import * as controller from './pedidos.controller';
import { cambiarEstadoSchema, crearPedidoSchema, idParamSchema, listPedidosQuerySchema } from './pedidos.schema';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(listPedidosQuerySchema), requirePermiso(PERMISOS.PEDIDOS_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.PEDIDOS_LEER), controller.getById);
router.post('/', validateBody(crearPedidoSchema), requirePermiso(PERMISOS.PEDIDOS_CREAR), controller.create);
router.patch(
  '/:id/estado',
  validateParams(idParamSchema),
  validateBody(cambiarEstadoSchema),
  requireRole(ROLES.ADMINISTRADOR, ROLES.ALMACENERO),
  controller.cambiarEstado,
);

export default router;
