import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { loginSchema, refreshTokenSchema } from './auth.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

// High-capacity login rate limiter to support multiple staff members on the same network
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Generous capacity allowing many employees to log in simultaneously from the same IP/router
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
});

router.post('/login', loginLimiter, validateBody(loginSchema), (req, res, next) => controller.login(req, res, next));
router.post('/refresh', validateBody(refreshTokenSchema), (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', authenticate, (req, res, next) => controller.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => controller.getMe(req, res, next));

export default router;
