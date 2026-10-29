import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('customer_debt_payments')
export class CustomerDebtPaymentEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  invoiceId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  customerPhone?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customerName?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 50, default: 'cash' })
  paymentMethod!: 'cash' | 'vodafone_cash' | 'instapay';

  @Column({ type: 'varchar', length: 50, nullable: true })
  vodafoneNumber?: string;

  @Column({ type: 'varchar', length: 50 })
  date!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  userName?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

