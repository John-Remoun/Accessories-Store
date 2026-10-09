import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InvoiceEntity } from './invoice.entity';
import { ProductEntity } from '../products/product.entity';
import { PhysicalItemEntity } from '../physical-items/physical-item.entity';

@Entity('invoice_items')
export class InvoiceItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  invoiceId!: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.invoiceItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: InvoiceEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  productId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productName?: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: ProductEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  physicalItemId?: string;

  @ManyToOne(() => PhysicalItemEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'physicalItemId' })
  physicalItem?: PhysicalItemEntity;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitCost!: number;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  profit!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
