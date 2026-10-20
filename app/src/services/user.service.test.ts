import { createHash } from 'crypto';
import { BadRequestError, NotFoundError } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import RefreshTokenEntity from '@/entities/auth/refresh-token.entity';
import RoleEntity from '@/entities/user/role.entity';
import UserEntity from '@/entities/user/user.entity';
import roleService from '@/services/role.service';
import userService from './user.service';

jest.mock('@/common/db/app-data-source', () => ({
  __esModule: true,
  default: { getRepository: jest.fn(), transaction: jest.fn() },
}));

const USER_ID = '6a1f2c3d-8e4b-4f5a-9b6c-7d8e9f0a1b2c';
const OTHER_ID = '7b2e3d4f-9f5c-4a6b-8c7d-8e9f0a1b2c3d';

interface QueryChain {
  leftJoinAndSelect: jest.Mock;
  innerJoin: jest.Mock;
  where: jest.Mock;
  getOne: jest.Mock;
  getCount: jest.Mock;
}

function buildQueryChain(): QueryChain {
  const chain = {} as QueryChain;
  chain.leftJoinAndSelect = jest.fn(() => chain);
  chain.innerJoin = jest.fn(() => chain);
  chain.where = jest.fn(() => chain);
  chain.getOne = jest.fn().mockResolvedValue(null);
  chain.getCount = jest.fn().mockResolvedValue(0);
  return chain;
}

const userRepository = { createQueryBuilder: jest.fn(), findOneBy: jest.fn(), remove: jest.fn() };
const manager = { save: jest.fn(), update: jest.fn() };
let chain: QueryChain;
let userSave: jest.SpyInstance;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function buildRole(name: string): RoleEntity {
  return Object.assign(new RoleEntity(), { id: `role-${name}`, name, permissions: [`${name}.all`] });
}

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: USER_ID,
    identities: [sha256('dana@example.com')],
    password: sha256('old-password' + 'test-password-salt'),
    is_active: true,
    mfa_enabled: false,
    roles: [buildRole('agent')],
    meta: { first_name: 'Dana' },
    ...overrides,
  });
}

// Makes identity lookups find these users, by the hash they're stored under.
function arrangeIdentities(owners: Record<string, UserEntity>): void {
  chain.getOne.mockImplementation(async () => {
    const [, params] = chain.where.mock.calls[chain.where.mock.calls.length - 1];
    const owner = Object.entries(owners).find(([identity]) => sha256(identity) === params.identity);
    return owner ? owner[1] : null;
  });
}

beforeEach(() => {
  // Drops any one-off value a test arranged and didn't use.
  [...Object.values(userRepository), ...Object.values(manager)].forEach((mock) => mock.mockReset());
  manager.save.mockImplementation(async (entity: unknown) => entity);
  jest.mocked(appDataSource.transaction).mockImplementation(async (run) => run(manager as never) as never);
  chain = buildQueryChain();
  userRepository.createQueryBuilder.mockReturnValue(chain);
  jest.mocked(appDataSource.getRepository).mockReturnValue(userRepository as never);
  userSave = jest.spyOn(UserEntity.prototype, 'save').mockImplementation(async function (this: never) {
    return this;
  });
  jest.spyOn(roleService, 'findRoleByName').mockImplementation(async (name: string) => {
    if (name === 'missing') {
      throw new NotFoundError('Role not found');
    }
    return buildRole(name);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('UserService - hashPassword', () => {
  it('should hash the password with the service salt', () => {
    expect(userService.hashPassword('secret')).toBe(sha256('secret' + 'test-password-salt'));
  });
});

describe('UserService - findUserByIdentity', () => {
  it('should look the user up by the hash of the identity, with their roles', async () => {
    // Arrange
    const user = buildUser();
    chain.getOne.mockResolvedValueOnce(user);

    // Act
    const result = await userService.findUserByIdentity('dana@example.com');

    // Assert
    expect(result).toBe(user);
    expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(chain.leftJoinAndSelect).toHaveBeenCalledWith('user.roles', 'roles');
    expect(chain.where).toHaveBeenCalledWith(':identity = ANY(user.identities)', {
      identity: sha256('dana@example.com'),
    });
  });

  it('should refuse an unknown identity', async () => {
    await expect(userService.findUserByIdentity('nobody@example.com')).rejects.toStrictEqual(
      new NotFoundError('User not found')
    );
  });
});

describe('UserService - createUser', () => {
  describe('should_save_the_user_when_no_identity_is_in_use', () => {
    it('should save hashed identities and password, the meta and the named roles', async () => {
      // Act
      const user = await userService.createUser({
        identities: ['dana@example.com', '0501234567'],
        password: 'secret',
        mfa_enabled: true,
        is_active: true,
        roles: ['admin', 'agent'],
        meta: { first_name: 'Dana' },
      });

      // Assert
      expect(userSave.mock.instances).toEqual([user]);
      expect(user).toMatchObject({
        identities: [sha256('dana@example.com'), sha256('0501234567')],
        password: sha256('secret' + 'test-password-salt'),
        mfa_enabled: true,
        is_active: true,
        meta: { first_name: 'Dana' },
      });
      expect(user.roles.map((role) => role.name)).toEqual(['admin', 'agent']);
    });

    it('should default to active, MFA off, no password and no meta', async () => {
      const user = await userService.createUser({ identities: ['dana@example.com'], roles: ['agent'] });

      expect(user).toMatchObject({ is_active: true, mfa_enabled: false, password: '', meta: null });
    });

    it('should save an inactive user only when is_active is false', async () => {
      const user = await userService.createUser({
        identities: ['dana@example.com'],
        roles: ['agent'],
        is_active: false,
      });

      expect(user.is_active).toBe(false);
    });
  });

  describe('should_refuse_the_user_when_it_cannot_be_saved_as_given', () => {
    it('should refuse an identity another user has, and save nothing', async () => {
      arrangeIdentities({ '0501234567': buildUser({ id: OTHER_ID }) });

      await expect(
        userService.createUser({ identities: ['dana@example.com', '0501234567'], roles: ['agent'] })
      ).rejects.toStrictEqual(new BadRequestError('User with identity 0501234567 already exists'));
      expect(userSave).not.toHaveBeenCalled();
    });

    it('should refuse an unknown role, and save nothing', async () => {
      await expect(
        userService.createUser({ identities: ['dana@example.com'], roles: ['missing'] })
      ).rejects.toStrictEqual(new NotFoundError('Role not found'));
      expect(userSave).not.toHaveBeenCalled();
    });
  });
});

describe('UserService - updateUser', () => {
  let user: UserEntity;

  beforeEach(() => {
    user = buildUser();
    userRepository.findOneBy.mockResolvedValue(user);
  });

  it('should refuse an unknown user', async () => {
    userRepository.findOneBy.mockResolvedValueOnce(null);

    await expect(userService.updateUser({ id: OTHER_ID })).rejects.toStrictEqual(new NotFoundError('User not found'));
    expect(userSave).not.toHaveBeenCalled();
  });

  it('should change only the fields present', async () => {
    // Arrange
    const before = { ...user };

    // Act
    const result = await userService.updateUser({ id: USER_ID, meta: { first_name: 'Noa' } });

    // Assert
    expect(result).toBe(user);
    expect(userSave.mock.instances).toEqual([user]);
    expect(user).toEqual({ ...before, meta: { first_name: 'Noa' } });
    expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: USER_ID });
  });

  it('should hash new identities and a new password, and set the flags and roles', async () => {
    await userService.updateUser({
      id: USER_ID,
      identities: ['noa@example.com'],
      password: 'new-password',
      mfa_enabled: true,
      is_active: false,
      roles: ['admin'],
    });

    expect(user).toMatchObject({
      identities: [sha256('noa@example.com')],
      password: sha256('new-password' + 'test-password-salt'),
      mfa_enabled: true,
      is_active: false,
    });
    expect(user.roles.map((role) => role.name)).toEqual(['admin']);
  });

  it.each([
    ['password', { password: undefined }, { password: '' }],
    ['mfa_enabled', { mfa_enabled: undefined }, { mfa_enabled: false }],
    ['is_active', { is_active: undefined }, { is_active: false }],
    ['meta', { meta: undefined }, { meta: null }],
  ])('should clear %s when it is given empty', async (_name, data, expected) => {
    user.mfa_enabled = true;

    await userService.updateUser({ id: USER_ID, ...data });

    expect(user).toMatchObject(expected);
  });

  it('should keep the identities when the list is empty', async () => {
    const identities = [...user.identities];

    await userService.updateUser({ id: USER_ID, identities: [] });

    expect(user.identities).toEqual(identities);
  });

  it('should accept identities the user already has', async () => {
    arrangeIdentities({ 'dana@example.com': user });

    await userService.updateUser({ id: USER_ID, identities: ['dana@example.com', 'dana@work.example.com'] });

    expect(user.identities).toEqual([sha256('dana@example.com'), sha256('dana@work.example.com')]);
  });

  it('should refuse an identity another user has, and change and save nothing', async () => {
    // Arrange
    arrangeIdentities({ 'noa@example.com': buildUser({ id: OTHER_ID }) });
    const before = { ...user };

    // Act
    const update = userService.updateUser({
      id: USER_ID,
      identities: ['dana@example.com', 'noa@example.com'],
      password: 'new-password',
      is_active: false,
      meta: { email: 'noa@example.com' },
      roles: ['admin'],
    });

    // Assert
    await expect(update).rejects.toStrictEqual(
      new BadRequestError('User with identity noa@example.com already exists')
    );
    expect(user).toEqual(before);
    expect(userSave).not.toHaveBeenCalled();
    expect(appDataSource.transaction).not.toHaveBeenCalled();
  });

  it('should refuse an unknown role, and save nothing', async () => {
    await expect(userService.updateUser({ id: USER_ID, roles: ['missing'] })).rejects.toBeInstanceOf(NotFoundError);
    expect(userSave).not.toHaveBeenCalled();
  });

  describe('should_end_the_user_sessions_when_the_update_leaves_them_inactive', () => {
    it.each([false, undefined])(
      'should save the user and revoke all their refresh tokens in one transaction for is_active %p',
      async (isActive) => {
        // Act
        await userService.updateUser({ id: USER_ID, is_active: isActive, meta: { first_name: 'Noa' } });

        // Assert
        expect(appDataSource.transaction).toHaveBeenCalledTimes(1);
        expect(manager.save).toHaveBeenCalledWith(user);
        expect(user).toMatchObject({ is_active: false, meta: { first_name: 'Noa' } });
        expect(manager.update).toHaveBeenCalledWith(RefreshTokenEntity, { user_id: USER_ID }, { revoked: true });
        expect(userSave).not.toHaveBeenCalled();
      }
    );

    it('should fail the update when the tokens cannot be revoked', async () => {
      const error = new Error('deadlock detected');
      manager.update.mockRejectedValueOnce(error);

      await expect(userService.updateUser({ id: USER_ID, is_active: false })).rejects.toBe(error);
    });

    it('should leave the tokens alone when the update keeps the user active', async () => {
      await userService.updateUser({ id: USER_ID, is_active: true });

      expect(manager.update).not.toHaveBeenCalled();
      expect(appDataSource.transaction).not.toHaveBeenCalled();
      expect(userSave).toHaveBeenCalledTimes(1);
    });

    it('should leave the tokens alone when the update does not mention is_active', async () => {
      await userService.updateUser({ id: USER_ID, meta: { first_name: 'Noa' } });

      expect(manager.update).not.toHaveBeenCalled();
      expect(userSave).toHaveBeenCalledTimes(1);
    });
  });
});

describe('UserService - getUser', () => {
  it('should find the user by identity when one is given', async () => {
    const user = buildUser();
    chain.getOne.mockResolvedValueOnce(user);

    await expect(userService.getUser({ identity: 'dana@example.com' })).resolves.toBe(user);
    expect(userRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('should find the user by id otherwise', async () => {
    const user = buildUser();
    userRepository.findOneBy.mockResolvedValueOnce(user);

    await expect(userService.getUser({ id: USER_ID })).resolves.toBe(user);
    expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: USER_ID });
  });

  it('should refuse a request with neither', async () => {
    await expect(userService.getUser({} as never)).rejects.toStrictEqual(new NotFoundError('User not found'));
  });
});

describe('UserService - deleteUser', () => {
  it('should remove the user', async () => {
    const user = buildUser();
    userRepository.findOneBy.mockResolvedValueOnce(user);

    await userService.deleteUser({ id: USER_ID });

    expect(userRepository.remove).toHaveBeenCalledWith(user);
  });

  it('should refuse an unknown user', async () => {
    userRepository.findOneBy.mockResolvedValueOnce(null);

    await expect(userService.deleteUser({ id: USER_ID })).rejects.toBeInstanceOf(NotFoundError);
    expect(userRepository.remove).not.toHaveBeenCalled();
  });
});

describe('UserService - isRoleUsed', () => {
  it.each([
    [0, false],
    [3, true],
  ])('should count the users with the role: %p means %p', async (count, used) => {
    chain.getCount.mockResolvedValueOnce(count);

    await expect(userService.isRoleUsed('role-admin')).resolves.toBe(used);
    expect(chain.innerJoin).toHaveBeenCalledWith('user.roles', 'role');
    expect(chain.where).toHaveBeenCalledWith('role.id = :roleId', { roleId: 'role-admin' });
  });
});
