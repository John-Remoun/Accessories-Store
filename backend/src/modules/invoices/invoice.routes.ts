import { Router } from 'express';
import { InvoiceController } from './invoice.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createInvoiceSchema } from './invoice.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new InvoiceController();

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));

router.post('/', authenticate, validateBody(createInvoiceSchema), (req, res, next) => controller.create(req, res, next));
router.post('/delete-many', authenticate, (req, res, next) => controller.deleteMany(req, res, next));
router.delete('/', authenticate, (req, res, next) => controller.deleteMany(req, res, next));
router.delete('/:id', authenticate, (req, res, next) => {
  req.body = { ids: [req.params.id] };
  return controller.deleteMany(req, res, next);
});
router.patch('/:id/toggle-favorite', authenticate, (req, res, next) => controller.toggleFavorite(req, res, next));
router.patch('/:id/pay', authenticate, (req, res, next) => controller.paySingleInvoice(req, res, next));
router.post('/pay-customer-debt', authenticate, (req, res, next) => controller.payCustomerDebt(req, res, next));

export default router;
