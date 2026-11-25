import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './proveedores.controller';
import { createProveedorSchema, idParamSchema, listProveedoresQuerySchema, updateProveedorSchema } from './proveedores.schema';

const router = Router();
router.use(authenticate);
router.get('/', validateQuery(listProveedoresQuerySchema), requirePermiso(PERMISOS.PROVEEDORES_LEER), controller.list);
router.get('/:id/productos', validateParams(idParamSchema), requirePermiso(PERMISOS.PROVEEDORES_LEER), controller.productos);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.PROVEEDORES_LEER), controller.getById);
router.post('/', validateBody(createProveedorSchema), requirePermiso(PERMISOS.PROVEEDORES_CREAR), controller.create);
router.patch('/:id', validateParams(idParamSchema), validateBody(updateProveedorSchema), requirePermiso(PERMISOS.PROVEEDORES_ACTUALIZAR), controller.update);
router.delete('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.PROVEEDORES_ELIMINAR), controller.remove);
export default router;
