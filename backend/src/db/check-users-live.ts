import { AppDataSource } from '../config/data-source';

async function check() {
  await AppDataSource.initialize();
  const users = await AppDataSource.query(`
    SELECT id, username, name, role, "branchId" 
    FROM users;
  `);
  console.log('Users in database (passwords omitted):', users);
  await AppDataSource.destroy();
}

check().catch(console.error);
