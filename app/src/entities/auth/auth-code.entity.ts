import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

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

  // A keyed hash of the code, never the code itself
  @Column()
  code_hash!: string;

  @Index('IDX_auth_codes_challenge_id', { unique: true })
  @Column()
  challenge_id!: string;

  // Codes tried against this challenge, right or wrong
  @Column({ type: 'integer', default: 0 })
  attempts = 0;

  @Index('IDX_auth_codes_expires_at')
  @Column()
  expires_at!: Date;
}
