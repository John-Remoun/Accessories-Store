import { Client } from 'pg';
import { env } from '../config/env.config';

async function initDatabase() {
  console.log('🔄 Checking PostgreSQL connection and database existence...');
  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.username,
    password: env.db.password,
    database: 'postgres',
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${env.db.database}'`);
    if (res.rowCount === 0) {
      console.log(`🔨 Database '${env.db.database}' does not exist. Creating it...`);
      await client.query(`CREATE DATABASE "${env.db.database}"`);
      console.log(`✅ Database '${env.db.database}' created successfully!`);
    } else {
      console.log(`✅ Database '${env.db.database}' already exists.`);
    }
  } catch (error) {
    console.error('❌ Failed to check/create database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDatabase();
