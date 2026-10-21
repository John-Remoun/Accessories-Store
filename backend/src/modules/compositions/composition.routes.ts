import { Router } from 'express';
import { CompositionController } from './composition.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createCompositionSchema } from './composition.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new CompositionController();

// All composition routes strictly require authentication
router.use(authenticate);

router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.post('/', validateBody(createCompositionSchema), (req, res, next) => controller.create(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;
