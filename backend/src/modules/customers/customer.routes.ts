import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createCustomerSchema } from './customer.validation';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new CustomerController();

// All customer routes strictly require authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));

router.post('/', validateBody(createCustomerSchema), (req, res, next) => controller.createOrUpdate(req, res, next));
router.delete('/:idOrPhone', authorizeRoles('admin', 'manager'), (req, res, next) => controller.delete(req, res, next));

export default router;
