import { Client } from 'pg';
import { env } from '../config/env.config';

const users = ['postgres', 'EL-Mostwred', 'admin', 'root'];
const passwords = [
  'postgres', 'postgres123', '123456', '12345678', '123456789',
  'admin', 'admin123', 'root', 'root123', 'password', 'password123',
  '1234', '12345', '0000', '1111', '2026', 'accessories', 'store'
];

async function findPassword() {
  console.log('🔍 Testing local PostgreSQL usernames & passwords...');
  for (const user of users) {
    for (const pass of passwords) {
      const client = new Client({
        host: env.db.host,
        port: env.db.port,
        user,
        password: pass,
        database: 'postgres',
      });

      try {
        await client.connect();
        console.log(`🎉 SUCCESS! User: "${user}", Password: "${pass}"`);
        await client.end();
        return { user, pass };
      } catch (e: any) {
        if (e.code === '28P01' || e.code === '28000') {
          // Authentication failed, continue
        } else {
          console.error(`Connection error for user "${user}" password "${pass}":`, e.message);
        }
      } finally {
        await client.end().catch(() => {});
      }
    }
  }
  console.log('❌ None of the test combinations worked.');
  return null;
}

findPassword();
