import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory or project root
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Strict environment validation in production
if (isProduction && !process.env.SKIP_ENV_VALIDATION) {
  const missing: string[] = [];

  const hasDb = Boolean(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    (process.env.DB_HOST && process.env.DB_PASSWORD)
  );
  if (!hasDb) {
    missing.push('DATABASE_URL (or POSTGRES_URL / DB_HOST+DB_PASSWORD)');
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    missing.push('JWT_ACCESS_SECRET');
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    missing.push('JWT_REFRESH_SECRET');
  }

  if (missing.length > 0) {
    const errorMsg = `[FATAL CONFIGURATION ERROR] Missing required production environment variable(s): ${missing.join(', ')}. Please configure them in your production environment settings.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Development-only fallback secrets (strictly disallowed in production)
const devFallbackJwtAccessSecret = 'dev_only_jwt_access_secret_not_for_production_use_123456789';
const devFallbackJwtRefreshSecret = 'dev_only_jwt_refresh_secret_not_for_production_use_123456789';

const accessSecret = process.env.JWT_ACCESS_SECRET || (isProduction ? '' : devFallbackJwtAccessSecret);
const refreshSecret = process.env.JWT_REFRESH_SECRET || (isProduction ? '' : devFallbackJwtRefreshSecret);

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  isProduction,
  db: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'accessories_store',
    ssl: process.env.DB_SSL === 'true' || (isProduction && Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)),
    // Reject unauthorized by default when SSL is active, unless explicitly toggled
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  },
  jwt: {
    accessSecret,
    refreshSecret,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN || '',
};
