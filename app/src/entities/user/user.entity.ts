import { Column, Entity, JoinTable, JoinColumn, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { UserEntityDTO } from 'iam-pkg';

import BaseEntity from '@/entities/base.entity';
import AuthCodeEntity from '@/entities/auth/auth-code.entity';
import RefreshTokenEntity from '@/entities/auth/refresh-token.entity';
import RoleEntity from './role.entity';
import { encryptionTransformer } from '@/common/transformers/encryption.transformer';

@Entity({ name: 'users' })
export default class UserEntity extends BaseEntity {
  @Column('text', { array: true })
  identities!: string[];

  @Column({ default: '' })
  password: string = '';

  @Column({ default: true })
  is_active: boolean = true;

  @Column({ default: false })
  mfa_enabled: boolean = false;

  @Column({
    type: 'text',
    nullable: true,
    transformer: encryptionTransformer,
  })
  meta!: Record<string, unknown> | null;

  @ManyToMany(() => RoleEntity, (role) => role.users, {
    eager: true,
  })
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  roles!: RoleEntity[];

  @OneToMany(() => AuthCodeEntity, (authCode) => authCode.user)
  auth_codes!: AuthCodeEntity[];

  @OneToMany(() => RefreshTokenEntity, (refreshToken) => refreshToken.user)
  refresh_tokens!: RefreshTokenEntity[];

  output(): UserEntityDTO {
    return {
      id: this.id,
      roles: this.roles?.map(role => role.output()),
      meta: this.meta ?? {}
    }
  }
}
