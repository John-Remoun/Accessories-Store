import { Router } from 'express';
import { CategoryController } from './category.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createCategorySchema, updateCategorySchema } from './category.validation';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new CategoryController();

// All category routes strictly require authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));
router.post('/', validateBody(createCategorySchema), (req, res, next) => controller.create(req, res, next));
router.patch('/:id', validateBody(updateCategorySchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;
