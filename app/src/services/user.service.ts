import { Repository } from 'typeorm';
import { NotFoundError, BadRequestError, GetAllRestQueryParams } from 'rest-pkg';
import { CreateUserDTO, UpdateUserDTO, GetUserDTO, DeleteUserDTO } from 'iam-pkg';

import roleService from '@/services/role.service';
import UserEntity from '@/entities/user/user.entity';
import appDataSource from '@/config/db.config';
import { sha256, applyRestQueryParams } from '@/common/utils';
import appConfig from '@/config/app.config';

class UserService {
  private userRepository: Repository<UserEntity> = appDataSource.getRepository(UserEntity);

  async findUserByIdentity(identity: string): Promise<UserEntity> {
    const user: UserEntity | null = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .where(':identity = ANY(user.identities)', { identity: this.hashIdentity(identity) })
      .getOne();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async findUserById(id: string): Promise<UserEntity> {
    const user: UserEntity | null = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async createUser(data: CreateUserDTO): Promise<UserEntity> {
    const identityInUse: string | false = await this.isAnyIdentityUsed(data.identities);
    if (identityInUse) {
      throw new BadRequestError(`User with identity ${identityInUse} already exists`);
    }

    const user = new UserEntity();
    user.identities = data.identities.map(identity => this.hashIdentity(identity));
    user.password = data.password ? this.hashPassword(data.password) : '';
    user.mfa_enabled = data.mfa_enabled ?? false;
    user.is_active = data.is_active === false ? false : true;
    user.meta = data.meta ?? null;
    user.roles = await Promise.all(
      data.roles.map(roleName => roleService.findRoleByName(roleName))
    );

    await user.save();

    return user;
  }

  async updateUser(data: UpdateUserDTO): Promise<UserEntity> {
    const user: UserEntity = await this.findUserById(data.id);

    if (data.identities) {
      const identityInUse: string | false = await this.isAnyIdentityUsed(data.identities, user.id);
      if (identityInUse) {
        throw new BadRequestError(`User with identity ${identityInUse} already exists`);
      }

      user.identities = data.identities.map(identity => this.hashIdentity(identity));
    }

    if ('password' in data) {
      user.password = data.password ? this.hashPassword(data.password) : '';
    }

    if ('mfa_enabled' in data) {
      user.mfa_enabled = data.mfa_enabled ?? false;
    }

    if ('is_active' in data) {
      user.is_active = data.is_active ?? false;
    }

    if ('meta' in data) {
      user.meta = data.meta ?? null;
    }

    if (data.roles) {
      user.roles = await Promise.all(
        data.roles.map(roleName => roleService.findRoleByName(roleName))
      );
    }

    await user.save();

    return user;
  }

  async getUser(data: GetUserDTO): Promise<UserEntity> {
    if (data.identity) {
      return await this.findUserByIdentity(data.identity);
    } else if (data.id) {
      return await this.findUserById(data.id);
    }

    throw new NotFoundError('User not found'); // Should never reach here
  }

  async getUsers(data: GetAllRestQueryParams): Promise<{ users: UserEntity[], count: number }> {
    const validFields = ['id', 'is_active', 'mfa_enabled', 'meta', 'roles'];

    // 1. Deduplicate and filter requested fields
    const requestedFields = Array.from(new Set(data.fields ?? [])).filter(f =>
      validFields.includes(f)
    );

    // 2. Start query builder
    let qb = this.userRepository.createQueryBuilder('user');

    // 3. Conditionally join roles if needed
    if (requestedFields.includes('roles')) {
      qb = qb.leftJoinAndSelect('user.roles', 'roles');
    }

    // 4. Call generic helper
    const queryParams: Partial<GetAllRestQueryParams> = { ...data };
    if (requestedFields.length > 0) {
      queryParams.fields = requestedFields;
    }

    applyRestQueryParams(qb, 'user', queryParams);

    // 5. Execute query
    const [users, count] = await qb.getManyAndCount();

    return { users, count };
  }

  async deleteUser(data: DeleteUserDTO): Promise<void> {
    const user: UserEntity = await this.findUserById(data.id);
    await this.userRepository.remove(user);
  }

  hashPassword(password: string): string {
    return sha256(password + appConfig.user.password_salt);
  }

  private hashIdentity(identity: string): string {
    return sha256(identity);
  }

  private async isAnyIdentityUsed(identities: string[], skipUserId?: string): Promise<string | false> {
    for (const identity of identities) {
      try {
        const user: UserEntity = await this.findUserByIdentity(identity);
        if (!skipUserId || user.id != skipUserId) {
          return identity; // Identity found
        }
      } catch (error) {
        // Identity not found
      }
    }

    return false;
  }
}

export default new UserService();
