import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import rateLimit from 'express-rate-limit';

import { env } from './config/env.config';
import { errorHandler } from './common/middleware/error.middleware';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import branchRoutes from './modules/branches/branch.routes';
import categoryRoutes from './modules/categories/category.routes';
import productRoutes from './modules/products/product.routes';
import physicalItemRoutes from './modules/physical-items/physical-item.routes';
import customerRoutes from './modules/customers/customer.routes';
import invoiceRoutes from './modules/invoices/invoice.routes';
import fixedExpenseRoutes from './modules/fixed-expenses/fixed-expense.routes';
import compositionRoutes from './modules/compositions/composition.routes';
import uploadRoutes from './modules/upload/upload.routes';

const app: Application = express();

// Security & Rate Limiting Middlewares
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(apiLimiter);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Serve Static Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

import { ensureDbConnected } from './common/middleware/db.middleware';

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', message: 'Accessories Store Backend API is healthy' });
});

// Database connection middleware for Serverless / Express
app.use(ensureDbConnected);

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/physical-items', physicalItemRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/fixed-expenses', fixedExpenseRoutes);
app.use('/api/v1/compositions', compositionRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
