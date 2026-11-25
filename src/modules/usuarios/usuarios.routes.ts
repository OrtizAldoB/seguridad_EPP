import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './usuarios.controller';
import {
  changePasswordSchema,
  createUsuarioSchema,
  idParamSchema,
  listUsuariosQuerySchema,
  updateEstadoSchema,
  updateUsuarioSchema,
} from './usuarios.schema';

const router = Router();

router.use(authenticate);

router.get('/catalogos', requirePermiso(PERMISOS.USUARIOS_LEER), controller.catalogs);
router.get('/', validateQuery(listUsuariosQuerySchema), requirePermiso(PERMISOS.USUARIOS_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.USUARIOS_LEER), controller.getById);

router.post('/', validateBody(createUsuarioSchema), requirePermiso(PERMISOS.USUARIOS_CREAR), controller.create);
router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateUsuarioSchema),
  requirePermiso(PERMISOS.USUARIOS_ACTUALIZAR),
  controller.update,
);
router.patch(
  '/:id/estado',
  validateParams(idParamSchema),
  validateBody(updateEstadoSchema),
  requirePermiso(PERMISOS.USUARIOS_ACTUALIZAR),
  controller.deactivate,
);
router.patch('/:id/password', validateParams(idParamSchema), validateBody(changePasswordSchema), controller.changePassword);
router.delete('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.USUARIOS_ELIMINAR), controller.deactivate);

export default router;
