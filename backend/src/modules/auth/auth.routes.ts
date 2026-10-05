import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { loginSchema, refreshTokenSchema } from './auth.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

router.post('/login', validateBody(loginSchema), (req, res, next) => controller.login(req, res, next));
router.post('/refresh', validateBody(refreshTokenSchema), (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', authenticate, (req, res, next) => controller.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => controller.getMe(req, res, next));

export default router;
