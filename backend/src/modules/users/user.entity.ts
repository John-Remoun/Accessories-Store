import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type Role = 'admin' | 'manager' | 'employee';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'employee' })
  role!: Role;

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branchId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  joinDate?: string;

  @Column({ type: 'int', default: 0 })
  salesCount!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, select: false })
  refreshToken?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
