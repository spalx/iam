import { EntityManager, Repository } from 'typeorm';
import { NotFoundError, BadRequestError } from '@spalx/rest-pkg';
import { CreateUserDTO, UpdateUserDTO, GetUserDTO, DeleteUserDTO } from '@spalx/iam-pkg';
import { logger } from '@spalx/common-loggers-pkg';

import roleService from '@/services/role.service';
import UserEntity from '@/entities/user/user.entity';
import RefreshTokenEntity from '@/entities/auth/refresh-token.entity';
import appDataSource from '@/common/db/app-data-source';
import { sha256 } from '@/common/utils';
import { hashPassword, verifyPassword } from '@/common/password-hash';

class UserService {
  private get userRepository(): Repository<UserEntity> {
    return appDataSource.getRepository(UserEntity);
  }

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
    user.identities = data.identities.map((identity) => this.hashIdentity(identity));
    user.password = data.password ? await hashPassword(data.password) : '';
    user.mfa_enabled = data.mfa_enabled ?? false;
    user.is_active = data.is_active === false ? false : true;
    user.meta = data.meta ?? null;
    user.roles = await Promise.all(data.roles.map((roleName) => roleService.findRoleByName(roleName)));

    await user.save();

    return user;
  }

  async updateUser(data: UpdateUserDTO): Promise<UserEntity> {
    const user: UserEntity = await this.findUserById(data.id);

    if (data.identities && data.identities.length > 0) {
      const identityInUse = await this.isAnyIdentityUsed(data.identities, user.id);
      if (identityInUse) {
        throw new BadRequestError(`User with identity ${identityInUse} already exists`);
      }

      user.identities = data.identities.map((identity) => this.hashIdentity(identity));
    }

    // Setting a password, or clearing one the user had, is a password change
    const passwordChanged: boolean = 'password' in data && (!!data.password || user.password !== '');
    if ('password' in data) {
      user.password = data.password ? await hashPassword(data.password) : '';
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
      user.roles = await Promise.all(data.roles.map((roleName) => roleService.findRoleByName(roleName)));
    }

    // Deactivation and a password change end the user's sessions: reactivating them later, or the old password, doesn't
    // bring the old ones back
    if (('is_active' in data && !user.is_active) || passwordChanged) {
      await appDataSource.transaction(async (manager: EntityManager) => {
        await manager.save(user);
        await manager.update(RefreshTokenEntity, { user_id: user.id }, { revoked: true });
      });
      return user;
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

  async deleteUser(data: DeleteUserDTO): Promise<void> {
    const user: UserEntity = await this.findUserById(data.id);
    await this.userRepository.remove(user);
  }

  /**
   * Whether the password is the user's. A stored hash of an older kind is replaced by a current one when it matches;
   * that is not a password change, so the user's sessions are kept, and a failure to save it doesn't fail the sign-in.
   */
  async checkPassword(user: UserEntity, password: string): Promise<boolean> {
    const { ok, needsUpgrade } = await verifyPassword(password, user.password);

    if (ok && needsUpgrade) {
      try {
        const upgraded = await hashPassword(password);
        await this.userRepository.update({ id: user.id }, { password: upgraded });
        user.password = upgraded;
      } catch (error) {
        logger.warn('Could not upgrade a password hash', {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return ok;
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

  async isRoleUsed(roleId: string): Promise<boolean> {
    return await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.id = :roleId', { roleId })
      .getCount()
      .then((count: number) => count > 0);
  }
}

export default new UserService();
