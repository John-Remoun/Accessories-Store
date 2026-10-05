import 'reflect-metadata';
import app from './app';
import { env } from './config/env.config';
import { AppDataSource } from './config/data-source';
import { seedDatabase } from './db/seed';

async function bootstrap() {
  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    await AppDataSource.initialize();
    console.log('✅ PostgreSQL Database connected successfully!');

    // Run seed data (branches & admin user)
    await seedDatabase();

    app.listen(env.port, () => {
      console.log(`🚀 Accessories Store Backend Server running on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (error) {
    console.error('❌ Failed to start Backend Server:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

bootstrap();
