import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './cotizaciones.controller';
import {
  actualizarCotizacionSchema,
  crearCotizacionSchema,
  idParamSchema,
  listCotizacionesQuerySchema,
} from './cotizaciones.schema';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(listCotizacionesQuerySchema), requirePermiso(PERMISOS.COTIZACIONES_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.COTIZACIONES_LEER), controller.getById);
router.post('/', validateBody(crearCotizacionSchema), requirePermiso(PERMISOS.COTIZACIONES_CREAR), controller.create);
router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(actualizarCotizacionSchema),
  requirePermiso(PERMISOS.COTIZACIONES_ACTUALIZAR),
  controller.update,
);
router.post('/:id/aceptar', validateParams(idParamSchema), requirePermiso(PERMISOS.COTIZACIONES_ACTUALIZAR), controller.aceptar);
router.post('/:id/rechazar', validateParams(idParamSchema), requirePermiso(PERMISOS.COTIZACIONES_ACTUALIZAR), controller.rechazar);
router.post('/:id/convertir', validateParams(idParamSchema), requirePermiso(PERMISOS.COTIZACIONES_ACTUALIZAR), controller.convertir);

export default router;
