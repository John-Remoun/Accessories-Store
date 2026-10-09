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

const defaultSupabaseUrl = 'postgresql://postgres.cybtacestgpbsluqmclr:Zni39zBUN7x0rfD7@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || defaultSupabaseUrl;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  ssl: (env.db.ssl || Boolean(dbUrl)) ? { rejectUnauthorized: false } : false,
  synchronize: true,
  logging: env.nodeEnv === 'development',
  entities: [
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
  ],
  migrations: [],
  subscribers: [],
});
