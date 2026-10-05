import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface InternalComponentPayload {
  productId: string;
  quantity: number;
  selectedPriceTier?: 'price1' | 'price2' | 'price3' | 'price4';
}

export interface ExternalComponentPayload {
  id: string;
  name: string;
  cost: number;
  quantity: number;
}

@Entity('product_compositions')
export class ProductCompositionEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  branchId!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price1!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price2!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price3!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price4?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCost!: number;

  @Column({ type: 'jsonb' })
  internalComponents!: InternalComponentPayload[];

  @Column({ type: 'jsonb' })
  externalComponents!: ExternalComponentPayload[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdProductId?: string;

  @Column({ type: 'varchar', length: 100 })
  createdAt!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
