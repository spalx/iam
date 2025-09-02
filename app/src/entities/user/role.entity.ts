import { Column, JoinColumn, Entity, ManyToMany, ManyToOne } from 'typeorm';
import { RoleEntityDTO } from 'iam-pkg';

import BaseEntity from '@/entities/base.entity';
import UserEntity from './user.entity';

@Entity({ name: 'roles' })
export default class RoleEntity extends BaseEntity {
  @Column({ unique: true })
  name!: string;

  @Column('text', { array: true })
  permissions!: string[];

  @ManyToMany(() => UserEntity, (user: UserEntity) => user.roles)
  users!: UserEntity[];

  output(): RoleEntityDTO {
    return {
      id: this.id,
      name: this.name,
      permissions: this.permissions
    }
  }
}
