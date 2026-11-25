import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso, requireRole } from '../../middleware/rbac';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS, ROLES } from '../../shared/constants';
import * as controller from './aprobaciones.controller';
import { decisionSchema, historialQuerySchema, idParamSchema } from './aprobaciones.controller';

const router = Router();

router.use(authenticate, requireRole(ROLES.ADMINISTRADOR));

router.get('/pendientes', requirePermiso(PERMISOS.APROBACIONES_LEER), controller.pendientes);
router.get('/historial', validateQuery(historialQuerySchema), requirePermiso(PERMISOS.APROBACIONES_LEER), controller.historial);
router.post(
  '/cotizaciones/:id',
  validateParams(idParamSchema),
  validateBody(decisionSchema),
  requirePermiso(PERMISOS.APROBACIONES_DECIDIR),
  controller.decidirCotizacion,
);
router.post(
  '/pedidos/:id',
  validateParams(idParamSchema),
  validateBody(decisionSchema),
  requirePermiso(PERMISOS.APROBACIONES_DECIDIR),
  controller.decidirPedido,
);

export default router;
