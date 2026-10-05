import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class ProductEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  nameEn!: string;

  @Column({ type: 'varchar', length: 200 })
  nameAr!: string;

  @Column({ type: 'text', default: '' })
  descriptionEn!: string;

  @Column({ type: 'text', default: '' })
  descriptionAr!: string;

  @Column({ type: 'varchar', length: 100 })
  categoryId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategoryId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  @Column({ type: 'varchar', length: 100 })
  productCode!: string;

  @Column({ type: 'varchar', length: 100 })
  material!: string;

  @Column({ type: 'varchar', length: 100 })
  color!: string;

  @Column({ type: 'varchar', length: 100 })
  size!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
