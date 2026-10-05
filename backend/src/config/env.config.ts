import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'accessories_store',
    ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access_token_secret_key_accessories_store_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_token_secret_key_accessories_store_2026',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
