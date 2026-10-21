import { Router } from 'express';
import { InvoiceController } from './invoice.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createInvoiceSchema, payCustomerDebtSchema, paySingleInvoiceSchema } from './invoice.validation';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new InvoiceController();

// All invoice routes strictly require authentication
router.use(authenticate);

router.get('/reports-summary', (req, res, next) => controller.getReportsSummary(req, res, next));
router.get('/customer-statement', (req, res, next) => controller.getCustomerStatement(req, res, next));
router.get('/customers-summary', (req, res, next) => controller.getCustomerSummaries(req, res, next));
router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/branch/:branchId', (req, res, next) => controller.getByBranch(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));

router.post('/', validateBody(createInvoiceSchema), (req, res, next) => controller.create(req, res, next));
router.post('/delete-many', authorizeRoles('admin'), (req, res, next) => controller.deleteMany(req, res, next));
router.delete('/', authorizeRoles('admin'), (req, res, next) => controller.deleteMany(req, res, next));
router.delete('/:id', authorizeRoles('admin'), (req, res, next) => {
  req.body = { ids: [req.params.id] };
  return controller.deleteMany(req, res, next);
});
router.patch('/:id/toggle-favorite', (req, res, next) => controller.toggleFavorite(req, res, next));
router.patch('/:id/pay', validateBody(paySingleInvoiceSchema), (req, res, next) => controller.paySingleInvoice(req, res, next));
router.put('/:id', (req, res, next) => controller.update(req, res, next));
router.post('/pay-customer-debt', validateBody(payCustomerDebtSchema), (req, res, next) => controller.payCustomerDebt(req, res, next));

export default router;
