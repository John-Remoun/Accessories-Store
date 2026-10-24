import { Router } from 'express';
import { PhysicalItemController } from './physical-item.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createPhysicalItemsSchema, updatePhysicalItemStatusSchema } from './physical-item.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new PhysicalItemController();

// All physical item routes strictly require authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/product/:productId', (req, res, next) => controller.getByProduct(req, res, next));
router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));

router.post('/generate', validateBody(createPhysicalItemsSchema), (req, res, next) => controller.generate(req, res, next));
router.patch('/:id/status', validateBody(updatePhysicalItemStatusSchema), (req, res, next) => controller.updateStatus(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;
