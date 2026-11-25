import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateBody, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './inventario.controller';
import { createMovimientoSchema, listKardexQuerySchema } from './inventario.schema';

const router = Router();

router.use(authenticate);

router.get('/kardex/resumen', requirePermiso(PERMISOS.INVENTARIO_LEER), controller.resumenKardex);
router.get(
  '/kardex',
  validateQuery(listKardexQuerySchema),
  requirePermiso(PERMISOS.INVENTARIO_LEER),
  controller.listKardex,
);
router.get('/disponibilidad', requirePermiso(PERMISOS.INVENTARIO_LEER), controller.disponibilidad);
router.get('/alertas', requirePermiso(PERMISOS.INVENTARIO_LEER), controller.alertas);
router.post(
  '/movimientos',
  validateBody(createMovimientoSchema),
  requirePermiso(PERMISOS.INVENTARIO_MOVIMIENTO),
  controller.registrarMovimiento,
);

export default router;
