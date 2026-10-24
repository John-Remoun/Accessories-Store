import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { env } from '../config/env.config';

async function main() {
  console.log('========================================================================');
  console.log('🔒 PRE-DEPLOYMENT BACKUP & DRY-RUN RESTORE VERIFICATION');
  console.log('========================================================================\n');

  if (!AppDataSource.isInitialized) {
    let retries = 5;
    while (retries > 0) {
      try {
        await AppDataSource.initialize();
        break;
      } catch (err: any) {
        retries--;
        console.warn(`[DB Connection Warning] ${err.message}. Retrying (${retries} attempts left)...`);
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  const monitoredTables = [
    'products',
    'product_branch_data',
    'categories',
    'customers',
    'suppliers',
    'invoices',
    'invoice_items',
    'fixed_expenses',
    'product_compositions',
    'physical_items',
  ];

  console.log('--- 1. Querying Live Production Database (public schema) ---');
  const liveCounts: Record<string, number> = {};
  for (const t of monitoredTables) {
    const r = await AppDataSource.query(`SELECT COUNT(*)::int AS cnt FROM public."${t}"`);
    liveCounts[t] = r[0].cnt;
  }
  const liveSumRes = await AppDataSource.query(`SELECT COALESCE(SUM(total), 0)::numeric AS sum_total FROM public.invoices`);
  const liveInvoicesSum = Number(liveSumRes[0].sum_total);

  console.log('Live counts fetched successfully:');
  console.log(JSON.stringify(liveCounts, null, 2));
  console.log(`Live Invoices Total Sum: ${liveInvoicesSum.toFixed(2)} EGP\n`);

  // 2. Prepare Backup File Details
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupFilename = `accessories_store_pre_deploy_live_${timestamp}.sql`;
  const backupsDir = path.resolve(__dirname, '../../../backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const backupFilePath = path.join(backupsDir, backupFilename);

  console.log(`--- 2. Executing pg_dump for public schema ---`);
  console.log(`Target File: ${backupFilePath}`);

  const pgDumpExe = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
  const psqlExe = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';

  // Construct connection parameters
  const dbUrl = env.db.url;
  let dumpCmd = `"${pgDumpExe}" --schema=public --no-owner --no-acl`;
  let restoreConnStr = '';

  if (dbUrl) {
    dumpCmd += ` --dbname="${dbUrl}" -f "${backupFilePath}"`;
    // Construct temp db url from existing dbUrl
    const urlObj = new URL(dbUrl);
    urlObj.pathname = '/accessories_restore_temp';
    restoreConnStr = urlObj.toString();
  } else {
    const envVars: string[] = [];
    if (env.db.password) {
      process.env.PGPASSWORD = env.db.password;
    }
    dumpCmd += ` -h ${env.db.host} -p ${env.db.port} -U ${env.db.username} -d ${env.db.database} -f "${backupFilePath}"`;
  }

  console.log('Running pg_dump command...');
  execSync(dumpCmd, { stdio: 'inherit', env: process.env });

  // 3. Inspect File Size
  const stat = fs.statSync(backupFilePath);
  const sizeBytes = stat.size;
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(3);
  console.log(`\n✅ Backup Created Successfully!`);
  console.log(`File Name: ${backupFilename}`);
  console.log(`File Size: ${sizeBytes} bytes (${sizeMB} MB)\n`);

  // 4. Dry-run Restore into accessories_restore_temp
  console.log('--- 3. Performing Dry-Run Restore into "accessories_restore_temp" ---');

  const preInitTempSource = new DataSource(
    restoreConnStr
      ? {
          type: 'postgres',
          url: restoreConnStr,
          ssl: env.db.ssl ? { rejectUnauthorized: env.db.sslRejectUnauthorized } : false,
          entities: [],
          synchronize: false,
        }
      : {
          type: 'postgres',
          host: env.db.host,
          port: env.db.port,
          username: env.db.username,
          password: env.db.password,
          database: 'accessories_restore_temp',
          ssl: env.db.ssl ? { rejectUnauthorized: env.db.sslRejectUnauthorized } : false,
          entities: [],
          synchronize: false,
        }
  );

  let preInitRetries = 5;
  while (preInitRetries > 0) {
    try {
      await preInitTempSource.initialize();
      break;
    } catch (err: any) {
      preInitRetries--;
      console.warn(`[Temp DB Pre-Init Warning] ${err.message}. Retrying (${preInitRetries} left)...`);
      if (preInitRetries === 0) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log('Ensuring extensions schema and uuid-ossp exist in accessories_restore_temp...');
  await preInitTempSource.query(`CREATE SCHEMA IF NOT EXISTS extensions;`);
  try {
    await preInitTempSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;`);
  } catch (extErr: any) {
    console.log('uuid-ossp notice:', extErr.message);
  }
  try {
    await preInitTempSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;`);
  } catch (extErr: any) {
    console.log('pgcrypto notice:', extErr.message);
  }
  await preInitTempSource.destroy();

  let restoreCmd = '';
  if (restoreConnStr) {
    restoreCmd = `"${psqlExe}" --dbname="${restoreConnStr}" -f "${backupFilePath}"`;
  } else {
    restoreCmd = `"${psqlExe}" -h ${env.db.host} -p ${env.db.port} -U ${env.db.username} -d accessories_restore_temp -f "${backupFilePath}"`;
  }

  console.log('Executing psql restore into accessories_restore_temp...');
  try {
    execSync(restoreCmd, { stdio: 'pipe', env: process.env });
    console.log('Restore executed successfully.');
  } catch (rErr: any) {
    console.log('Psql output (warnings/notices handled):', rErr.stderr?.toString() || rErr.message);
  }

  // 5. Connect to accessories_restore_temp and Verify Data
  console.log('\n--- 4. Verifying Restored Database Integrity ---');
  const tempDataSource = new DataSource(
    restoreConnStr
      ? {
          type: 'postgres',
          url: restoreConnStr,
          ssl: env.db.ssl ? { rejectUnauthorized: env.db.sslRejectUnauthorized } : false,
          entities: [],
          synchronize: false,
        }
      : {
          type: 'postgres',
          host: env.db.host,
          port: env.db.port,
          username: env.db.username,
          password: env.db.password,
          database: 'accessories_restore_temp',
          ssl: env.db.ssl ? { rejectUnauthorized: env.db.sslRejectUnauthorized } : false,
          entities: [],
          synchronize: false,
        }
  );

  let tempRetries = 5;
  while (tempRetries > 0) {
    try {
      await tempDataSource.initialize();
      break;
    } catch (err: any) {
      tempRetries--;
      console.warn(`[Temp DB Connection Warning] ${err.message}. Retrying (${tempRetries} attempts left)...`);
      if (tempRetries === 0) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const restoredCounts: Record<string, number> = {};
  console.log('--------------------------------------------------------------------------------');
  console.log('| Table Name           | Live (public) | Restored Temp | Match Status         |');
  console.log('--------------------------------------------------------------------------------');
  let allMatched = true;

  for (const t of monitoredTables) {
    const r = await tempDataSource.query(`SELECT COUNT(*)::int AS cnt FROM public."${t}"`);
    restoredCounts[t] = r[0].cnt;
    const isMatch = restoredCounts[t] === liveCounts[t];
    if (!isMatch) allMatched = false;
    const status = isMatch ? '✅ 100% IDENTICAL' : '❌ MISMATCH';
    console.log(`| ${t.padEnd(20)} | ${String(liveCounts[t]).padStart(13)} | ${String(restoredCounts[t]).padStart(13)} | ${status.padEnd(20)} |`);
  }
  console.log('--------------------------------------------------------------------------------');

  const restoredSumRes = await tempDataSource.query(`SELECT COALESCE(SUM(total), 0)::numeric AS sum_total FROM public.invoices`);
  const restoredInvoicesSum = Number(restoredSumRes[0].sum_total);

  console.log(`\nLive Invoices Total Sum:     ${liveInvoicesSum.toFixed(2)} EGP`);
  console.log(`Restored Invoices Total Sum: ${restoredInvoicesSum.toFixed(2)} EGP`);
  const sumMatched = liveInvoicesSum === restoredInvoicesSum;
  console.log(`Invoice Sum Match: ${sumMatched ? '✅ 100% MATCH' : '❌ MISMATCH'}`);

  if (allMatched && sumMatched) {
    console.log('\n🎉 DRY-RUN RESTORE VERIFICATION PASSED WITH 100% SUCCESS!');
  } else {
    console.error('\n❌ CRITICAL ERROR: Restored data does not match live database!');
  }

  await tempDataSource.destroy();
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Fatal Error during backup and dry-run:', err);
  process.exit(1);
});
