import { Router } from 'express';
import { SalaryWithdrawalController } from './salary-withdrawal.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new SalaryWithdrawalController();

router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.post('/', (req, res, next) => controller.create(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;

