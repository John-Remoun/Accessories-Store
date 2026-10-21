import { Router } from 'express';
import { BranchController } from './branch.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createBranchSchema, updateBranchSchema } from './branch.validation';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new BranchController();

// All branch routes strictly require authentication
router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));
router.post('/', authorizeRoles('admin'), validateBody(createBranchSchema), (req, res, next) => controller.create(req, res, next));
router.patch('/:id', authorizeRoles('admin'), validateBody(updateBranchSchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', authorizeRoles('admin'), (req, res, next) => controller.delete(req, res, next));

export default router;
