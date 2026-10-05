import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createCustomerSchema } from './customer.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new CustomerController();

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));

router.post('/', authenticate, validateBody(createCustomerSchema), (req, res, next) => controller.createOrUpdate(req, res, next));
router.delete('/:idOrPhone', authenticate, (req, res, next) => controller.delete(req, res, next));

export default router;
