import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './solicitudes.controller';
import {
  createSolicitudSchema,
  decisionSolicitudSchema,
  idParamSchema,
  listSolicitudesQuerySchema,
} from './solicitudes.schema';

const router = Router();
router.use(authenticate);

router.get('/', validateQuery(listSolicitudesQuerySchema), requirePermiso(PERMISOS.SOLICITUDES_LEER), controller.list);
router.get('/:id', validateParams(idParamSchema), requirePermiso(PERMISOS.SOLICITUDES_LEER), controller.getById);
router.post('/', validateBody(createSolicitudSchema), requirePermiso(PERMISOS.SOLICITUDES_CREAR), controller.create);
router.post(
  '/:id/aprobar',
  validateParams(idParamSchema),
  validateBody(decisionSolicitudSchema),
  requirePermiso(PERMISOS.SOLICITUDES_DECIDIR),
  controller.aprobar,
);
router.post(
  '/:id/rechazar',
  validateParams(idParamSchema),
  validateBody(decisionSolicitudSchema),
  requirePermiso(PERMISOS.SOLICITUDES_DECIDIR),
  controller.rechazar,
);

export default router;
