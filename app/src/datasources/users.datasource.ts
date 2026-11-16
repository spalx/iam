import { Repository } from 'typeorm';
import { GetAllRestQueryParams } from '@spalx/rest-pkg';

import { Datasource } from './datasource';
import UserEntity from '@/entities/user/user.entity';
import appDataSource from '@/common/db/app-data-source';

// A user's details are encrypted, so the list offers no filter on them: every request filters, pages and
// counts in SQL, and decrypts only the users it returns.
class UsersDatasource extends Datasource<UserEntity> {
  protected fieldMap: Record<string, string> = {
    id: 'user.id',
    is_active: 'user.is_active',
    mfa_enabled: 'user.mfa_enabled',
    role_name: 'roles.name',
    created_at: 'user.created_at',
    updated_at: 'user.updated_at',
  };

  constructor(readonly params: GetAllRestQueryParams) {
    const userRepository: Repository<UserEntity> = appDataSource.getRepository(UserEntity);
    super(userRepository, params);
  }

  protected alias(): string {
    return 'user';
  }

  protected buildJoins(): void {
    this.builder.leftJoinAndSelect('user.roles', 'roles');
  }

  protected override defaultSortField(): string | null {
    return 'user.created_at';
  }
}

export default UsersDatasource;
