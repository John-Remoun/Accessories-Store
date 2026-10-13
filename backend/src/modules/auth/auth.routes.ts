import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { loginSchema, refreshTokenSchema } from './auth.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

// Strict login rate limiter to protect against brute-force & credential stuffing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
});

router.post('/login', loginLimiter, validateBody(loginSchema), (req, res, next) => controller.login(req, res, next));
router.post('/refresh', validateBody(refreshTokenSchema), (req, res, next) => controller.refresh(req, res, next));
router.post('/logout', authenticate, (req, res, next) => controller.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => controller.getMe(req, res, next));

export default router;
