import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import BaseEntity from '@/entities/base.entity';
import UserEntity from '@/entities/user/user.entity';

@Entity({ name: 'auth_codes' })
export default class AuthCodeEntity extends BaseEntity {
  @Column()
  user_id!: string;

  @ManyToOne(() => UserEntity, (user) => user.auth_codes, {
    eager: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column()
  mfa_code!: string;

  @Column()
  challenge_id!: string;

  @Column()
  expires_at!: Date;
}
