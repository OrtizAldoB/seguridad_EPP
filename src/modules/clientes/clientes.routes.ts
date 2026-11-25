import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './clientes.controller';
import {
  createClienteSchema,
  idParamSchema,
  listClientesQuerySchema,
  updateClienteSchema,
} from './clientes.schema';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(listClientesQuerySchema), requirePermiso(PERMISOS.CLIENTES_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.CLIENTES_LEER), controller.getById);
router.post('/', validateBody(createClienteSchema), requirePermiso(PERMISOS.CLIENTES_CREAR), controller.create);
router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateClienteSchema),
  requirePermiso(PERMISOS.CLIENTES_ACTUALIZAR),
  controller.update,
);
router.delete('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.CLIENTES_ELIMINAR), controller.remove);

export default router;
