import 'reflect-metadata';
import http from 'http';
import app from './app';
import { env } from './config/env.config';
import { AppDataSource } from './config/data-source';
import { seedDatabase } from './db/seed';
import { initSocketServer } from './common/socket/socket.service';

async function bootstrap() {
  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    await AppDataSource.initialize();
    console.log('✅ PostgreSQL Database connected successfully!');

    // Run seed data (branches & admin user)
    await seedDatabase();

    const server = http.createServer(app);
    initSocketServer(server);

    server.listen(env.port, () => {
      console.log(`🚀 Accessories Store Backend Server running on port ${env.port} [${env.nodeEnv}] (with Socket.io)`);
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
