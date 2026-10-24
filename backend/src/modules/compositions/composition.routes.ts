import { Router } from 'express';
import { CompositionController } from './composition.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createCompositionSchema } from './composition.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new CompositionController();

// All composition routes strictly require authentication
router.use(authenticate);

router.get('/', (req, res, next) => {
  const branchId = (req.query.branchId as string) || (req as any).user?.branchId || 'b1';
  (req.params as any).branchId = branchId;
  return controller.getByBranch(req, res, next);
});
router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));
router.post('/', validateBody(createCompositionSchema), (req, res, next) => controller.create(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;
