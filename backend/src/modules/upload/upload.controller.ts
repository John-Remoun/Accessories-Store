import { Request, Response, NextFunction } from 'express';
import { sendResponse } from '../../common/utils/response.utils';
import { AppError } from '../../common/exceptions/app-error';

export class UploadController {
  public async uploadSingle(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      return sendResponse(res, 201, 'File uploaded successfully', { url: fileUrl, filename: req.file.filename });
    } catch (error) {
      next(error);
    }
  }
}
