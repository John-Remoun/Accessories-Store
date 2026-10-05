import { Router } from 'express';
import { FixedExpenseController } from './fixed-expense.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createFixedExpenseSchema } from './fixed-expense.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new FixedExpenseController();

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.post('/', authenticate, validateBody(createFixedExpenseSchema), (req, res, next) => controller.create(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => controller.delete(req, res, next));

export default router;
