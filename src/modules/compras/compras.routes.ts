import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './compras.controller';
import { createCompraSchema, idParamSchema, listComprasQuerySchema } from './compras.schema';

const router = Router();
router.use(authenticate);
router.get('/', validateQuery(listComprasQuerySchema), requirePermiso(PERMISOS.COMPRAS_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.COMPRAS_LEER), controller.getById);
router.post('/', validateBody(createCompraSchema), requirePermiso(PERMISOS.COMPRAS_CREAR), controller.create);
router.post('/:id/recibir', validateParams(idParamSchema), requirePermiso(PERMISOS.COMPRAS_ACTUALIZAR), controller.recibir);
router.post('/:id/cancelar', validateParams(idParamSchema), requirePermiso(PERMISOS.COMPRAS_ACTUALIZAR), controller.cancelar);
export default router;
