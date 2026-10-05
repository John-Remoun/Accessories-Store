import { Router } from 'express';
import { BranchController } from './branch.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createBranchSchema, updateBranchSchema } from './branch.validation';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new BranchController();

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));
router.post('/', authenticate, authorizeRoles('admin'), validateBody(createBranchSchema), (req, res, next) => controller.create(req, res, next));
router.patch('/:id', authenticate, authorizeRoles('admin'), validateBody(updateBranchSchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', authenticate, authorizeRoles('admin'), (req, res, next) => controller.delete(req, res, next));

export default router;
