import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './reportes.controller';
import { exportQuerySchema, reporteQuerySchema, topQuerySchema } from './reportes.schema';

const router = Router();

router.use(authenticate);

const puedeLeer = requirePermiso(PERMISOS.REPORTES_LEER);
const puedeExportar = requirePermiso(PERMISOS.REPORTES_LEER, PERMISOS.REPORTES_EXPORTAR);

router.get('/resumen', validateQuery(reporteQuerySchema), puedeLeer, controller.resumen);
router.get('/ventas', validateQuery(reporteQuerySchema), puedeLeer, controller.ventas);
router.get('/cotizaciones', validateQuery(reporteQuerySchema), puedeLeer, controller.cotizaciones);
router.get('/kardex', validateQuery(reporteQuerySchema), puedeLeer, controller.kardex);
router.get('/top-productos', validateQuery(topQuerySchema), puedeLeer, controller.topProductos);
router.get('/top-clientes', validateQuery(topQuerySchema), puedeLeer, controller.topClientes);
router.get('/exportar.xlsx', validateQuery(exportQuerySchema), puedeExportar, controller.exportarXlsx);
router.get('/exportar.pdf', validateQuery(exportQuerySchema), puedeExportar, controller.exportarPdf);

export default router;
