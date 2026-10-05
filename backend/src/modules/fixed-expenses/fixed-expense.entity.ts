import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fixed_expenses')
export class FixedExpenseEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 50, default: 'monthly' })
  type!: 'daily' | 'monthly';

  @Column({ type: 'varchar', length: 50 })
  date!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
