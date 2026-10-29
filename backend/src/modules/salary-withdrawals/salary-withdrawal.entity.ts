import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('salary_withdrawals')
export class SalaryWithdrawalEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  userId!: string;

  @Column({ type: 'varchar', length: 150 })
  userName!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: number;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ type: 'varchar', length: 50 })
  date!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

