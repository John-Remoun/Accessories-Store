import { Router } from 'express';
import { customerDebtPaymentController } from './customer-debt-payment.controller';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', (req, res, next) => customerDebtPaymentController.getDebtPayments(req, res, next));
router.post('/', (req, res, next) => customerDebtPaymentController.createDebtPayment(req, res, next));
router.delete('/:id', authorizeRoles('admin'), (req, res, next) => customerDebtPaymentController.deleteDebtPayment(req, res, next));

export default router;

