import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermiso } from '../../middleware/rbac';
import { validateParams, validateQuery } from '../../middleware/validate';
import { PERMISOS } from '../../shared/constants';
import * as controller from './notificaciones.controller';
import { idParamSchema, listQuerySchema } from './notificaciones.controller';

const router = Router();

router.use(authenticate, requirePermiso(PERMISOS.NOTIFICACIONES_LEER));

router.get('/', validateQuery(listQuerySchema), controller.list);
router.patch('/leer-todas', controller.marcarTodas);
router.patch('/:id/leida', validateParams(idParamSchema), controller.marcarLeida);

export default router;
