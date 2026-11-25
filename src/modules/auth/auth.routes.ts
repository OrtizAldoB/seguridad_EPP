import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as controller from './auth.controller';
import { loginSchema, registroSchema, refreshSchema } from './auth.schema';

const router = Router();

router.post('/registro', validateBody(registroSchema), controller.registro);
router.post('/login', validateBody(loginSchema), controller.login);
router.post('/refresh', validateBody(refreshSchema), controller.refresh);
router.post('/logout', authenticate, validateBody(refreshSchema), controller.logout);
router.get('/me', authenticate, controller.me);

export default router;
