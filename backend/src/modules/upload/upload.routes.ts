import { Router } from 'express';
import { UploadController } from './upload.controller';
import { upload } from '../../common/middleware/upload.middleware';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new UploadController();

router.post('/single', authenticate, upload.single('file'), (req, res, next) => controller.uploadSingle(req, res, next));

export default router;
