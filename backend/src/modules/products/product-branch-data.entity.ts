import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('product_branch_data')
@Index(['productId', 'branchId'], { unique: true })
export class ProductBranchDataEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  productId!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cost!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price1!: number;

  @Column({ type: 'varchar', length: 100, default: 'قطاعي' })
  price1Label!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price2!: number;

  @Column({ type: 'varchar', length: 100, default: 'جملة' })
  price2Label!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price3!: number;

  @Column({ type: 'varchar', length: 100, default: 'سعر خاص VIP' })
  price3Label!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price4!: number;

  @Column({ type: 'varchar', length: 100, default: 'سعر 4' })
  price4Label!: string;

  @Column({ type: 'int', default: 0 })
  minStock!: number;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
