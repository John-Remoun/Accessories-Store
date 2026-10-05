import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type PhysicalItemStatus = 'available' | 'sold' | 'reserved' | 'damaged' | 'lost';

@Entity('physical_items')
export class PhysicalItemEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  productId!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'varchar', length: 50, default: 'available' })
  status!: PhysicalItemStatus;

  @Column({ type: 'varchar', length: 100 })
  serialNumber!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
