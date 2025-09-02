import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import BaseEntity from '@/entities/base.entity';
import UserEntity from '@/entities/user/user.entity';

@Entity({ name: 'refresh_tokens' })
export default class RefreshTokenEntity extends BaseEntity {
  @Column()
  user_id!: string;

  @ManyToOne(() => UserEntity, (user) => user.refresh_tokens, {
    eager: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ unique: true })
  token!: string;

  @Column('text', { array: true, default: () => 'ARRAY[]::text[]' })
  fingerprints!: string[];

  @Column()
  expires_at!: Date;

  @Column({ default: false })
  revoked: boolean = false;
}
