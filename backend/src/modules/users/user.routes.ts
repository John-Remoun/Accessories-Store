import { Router } from 'express';
import { UserController } from './user.controller';
import { validateBody } from '../../common/middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './user.validation';
import { authenticate, authorizeRoles } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new UserController();

router.use(authenticate);

router.get('/', (req, res, next) => controller.getAll(req, res, next));
router.get('/:id', (req, res, next) => controller.getOne(req, res, next));
router.post('/', authorizeRoles('admin'), validateBody(createUserSchema), (req, res, next) => controller.create(req, res, next));
router.patch('/:id', validateBody(updateUserSchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', authorizeRoles('admin'), (req, res, next) => controller.delete(req, res, next));

export default router;
