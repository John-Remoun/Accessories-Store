import { DataSource } from 'typeorm';
import { env } from './env.config';
import { UserEntity } from '../modules/users/user.entity';
import { BranchEntity } from '../modules/branches/branch.entity';
import { CategoryEntity } from '../modules/categories/category.entity';
import { ProductEntity } from '../modules/products/product.entity';
import { ProductBranchDataEntity } from '../modules/products/product-branch-data.entity';
import { PhysicalItemEntity } from '../modules/physical-items/physical-item.entity';
import { CustomerEntity } from '../modules/customers/customer.entity';
import { InvoiceEntity } from '../modules/invoices/invoice.entity';
import { InvoiceItemEntity } from '../modules/invoices/invoice-item.entity';
import { FixedExpenseEntity } from '../modules/fixed-expenses/fixed-expense.entity';
import { ProductCompositionEntity } from '../modules/compositions/composition.entity';
import { SupplierEntity } from '../modules/suppliers/supplier.entity';
import { InitialMigration1700000000000 } from '../db/migrations/1700000000000-InitialMigration';
import { EnableRLSAndHardenPermissions1700000000001 } from '../db/migrations/1700000000001-EnableRLSAndHardenPermissions';
import { AddPerformanceIndexes1700000000002 } from '../db/migrations/1700000000002-AddPerformanceIndexes';

const dbUrl = env.db.url;

const sslConfig = env.db.ssl
  ? { rejectUnauthorized: env.db.sslRejectUnauthorized }
  : false;

const entities = [
  UserEntity,
  BranchEntity,
  CategoryEntity,
  ProductEntity,
  ProductBranchDataEntity,
  PhysicalItemEntity,
  CustomerEntity,
  InvoiceEntity,
  InvoiceItemEntity,
  FixedExpenseEntity,
  ProductCompositionEntity,
  SupplierEntity,
];

const migrations = [
  InitialMigration1700000000000,
  EnableRLSAndHardenPermissions1700000000001,
  AddPerformanceIndexes1700000000002,
];

export const AppDataSource = new DataSource(
  dbUrl
    ? {
        type: 'postgres',
        url: dbUrl,
        ssl: sslConfig,
        synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
        logging: env.nodeEnv === 'development',
        entities,
        migrations,
        subscribers: [],
      }
    : {
        type: 'postgres',
        host: env.db.host,
        port: env.db.port,
        username: env.db.username,
        password: env.db.password,
        database: env.db.database,
        ssl: sslConfig,
        synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
        logging: env.nodeEnv === 'development',
        entities,
        migrations,
        subscribers: [],
      }
);
