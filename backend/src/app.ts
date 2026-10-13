import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.config';
import { errorHandler } from './common/middleware/error.middleware';
import { ensureDbConnected } from './common/middleware/db.middleware';

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
import supplierRoutes from './modules/suppliers/supplier.routes';

const app: Application = express();

// Trust reverse proxy (Render, Vercel, Cloudflare) for accurate IP resolution
app.set('trust proxy', 1);

// Security & High-Capacity Rate Limiting Middlewares
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // High capacity to support multi-user POS traffic and multiple employees
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
});

// Configure CORS securely
const configuredOrigins = env.corsOrigin
  ? env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server, mobile app, or same-origin requests without Origin header
    if (!origin) return callback(null, true);

    // Explicitly allowed origin in config
    if (configuredOrigins.length > 0 && configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow local development origins
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // Allow verified project domain on Vercel
    const isTrustedVercelApp = /^https:\/\/accessories-store[a-zA-Z0-9-]*\.vercel\.app$/.test(origin);
    if (isTrustedVercelApp) {
      return callback(null, true);
    }

    return callback(new Error('CORS request blocked by security policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Managed by frontend hosting
}));
app.use(cors(corsOptions));
app.use(apiLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Serve Static Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', message: 'Accessories Store Backend API is healthy' });
});

// Database connection middleware for Serverless / Express
app.use(ensureDbConnected);

// API Router
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/branches', branchRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/physical-items', physicalItemRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/fixed-expenses', fixedExpenseRoutes);
apiRouter.use('/compositions', compositionRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/suppliers', supplierRoutes);

// Support all possible Vercel / Express request path variations:
app.use('/api/v1', apiRouter);
app.use('/v1', apiRouter);
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global Error Handler
app.use(errorHandler);

export default app;
