import { Router } from 'express';
import { FixedExpenseController } from './fixed-expense.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createFixedExpenseSchema } from './fixed-expense.validation';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new FixedExpenseController();

// All expense routes strictly require authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.post('/', validateBody(createFixedExpenseSchema), (req, res, next) => controller.create(req, res, next));
router.delete('/:id', authorizeRoles('admin', 'manager'), (req, res, next) => controller.delete(req, res, next));

export default router;
