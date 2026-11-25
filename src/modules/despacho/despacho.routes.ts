import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateParams } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './despacho.controller';
import { pedidoIdParamSchema } from './despacho.schema';

const router = Router();

router.use(authenticate);

router.get('/pendientes', requirePermiso(PERMISOS.PEDIDOS_LEER), controller.pendientes);
router.get(
  '/pick-list/:pedidoId',
  validateParams(pedidoIdParamSchema),
  requirePermiso(PERMISOS.PEDIDOS_LEER),
  controller.pickList,
);
router.post(
  '/confirmar/:pedidoId',
  validateParams(pedidoIdParamSchema),
  requirePermiso(PERMISOS.PEDIDOS_DESPACHAR),
  controller.confirmar,
);

export default router;
