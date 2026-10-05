import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { InvoiceItemEntity } from './invoice-item.entity';

export interface InvoiceItemPayload {
  physicalItemId: string;
  productId: string;
  unitPrice: number;
  unitCost?: number;
  quantity?: number;
  profit?: number;
}

@Entity('invoices')
export class InvoiceEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  invoiceNumber!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'varchar', length: 100 })
  employeeId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerId?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customerName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customerPhone?: string;

  @Column({ type: 'varchar', length: 100 })
  date!: string;

  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice, { cascade: true, eager: true })
  invoiceItems!: InvoiceItemEntity[];

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discount!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalCost!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  netProfit!: number;

  @Column({ type: 'varchar', length: 50, default: 'cash' })
  paymentMethod!: 'cash' | 'card' | 'transfer' | 'vodafone_cash' | 'instapay';

  @Column({ type: 'varchar', length: 50, default: 'paid' })
  paymentStatus!: 'paid' | 'partial' | 'deferred';

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentSubMethod?: 'cash' | 'vodafone_cash' | 'instapay';

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  paidAmount!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  remainingAmount!: number;

  @Column({ type: 'boolean', default: false })
  isFavorite!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
