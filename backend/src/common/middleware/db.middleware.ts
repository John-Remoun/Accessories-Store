import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/data-source';

export const ensureDbConnected = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    next();
  } catch (error) {
    console.error('❌ Database connection error:', error);
    res.status(500).json({ success: false, message: 'Database connection failure' });
  }
};
