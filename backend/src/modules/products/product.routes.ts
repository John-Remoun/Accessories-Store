import { Router } from 'express';
import { ProductController } from './product.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createProductSchema, updateProductSchema, productBranchDataSchema } from './product.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new ProductController();

// All product routes strictly require authentication
router.use(authenticate);

router.get('/branch-data/all', (req, res, next) => controller.getAllBranchData(req, res, next));
router.get('/branch-data/:productId/:branchId', (req, res, next) => controller.getBranchData(req, res, next));
router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));

router.post('/', validateBody(createProductSchema), (req, res, next) => controller.create(req, res, next));
router.post('/branch-data', validateBody(productBranchDataSchema), (req, res, next) => controller.updateBranchData(req, res, next));
router.post('/adjust-stock', (req, res, next) => controller.adjustStock(req, res, next));

router.patch('/:id', validateBody(updateProductSchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;
