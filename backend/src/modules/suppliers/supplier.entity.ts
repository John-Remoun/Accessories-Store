import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface SupplierPaymentRecord {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

@Entity('suppliers')
export class SupplierEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  supplierName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  supplierPhone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  invoiceNumber?: string;

  @Column({ type: 'text', nullable: true })
  itemsDescription?: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  remainingAmount!: number;

  @Column({ type: 'varchar', length: 50, default: 'unpaid' })
  paymentStatus!: 'paid' | 'partial' | 'unpaid';

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  purchaseDate!: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  paymentHistory!: SupplierPaymentRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
