import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';
import { EntityManager } from 'typeorm';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import { sha256 } from '@/common/utils';
import authController from '@/controllers/auth.controller';
import userController from '@/controllers/user.controller';
import RoleEntity from '@/entities/user/role.entity';
import UserEntity from '@/entities/user/user.entity';
import { expireAuthCode, saveRole, saveUser } from '../factories/iam.factory';

const PASSWORD = 'correct horse';

interface RefreshTokenRow {
  user_id: string;
  token: string;
  fingerprints: string[];
  revoked: boolean;
}

function request<T>(data: T): never {
  return { id: 'c0ffee00-0000-4000-8000-000000000001', data } as never;
}

async function refreshTokenRows(userId?: string): Promise<RefreshTokenRow[]> {
  const rows = await appDataSource.query<RefreshTokenRow[]>(
    'SELECT user_id, token, fingerprints, revoked FROM refresh_tokens ORDER BY created_at'
  );
  return userId ? rows.filter((row) => row.user_id === userId) : rows;
}

async function login(
  identity: string,
  fingerprints?: string[]
): Promise<{ access_token: string; refresh_token: string }> {
  return authController.createToken(request({ identity, password: PASSWORD, fingerprints }));
}

let admin: RoleEntity;

beforeEach(async () => {
  admin = await saveRole({ name: 'admin' });
});

describe('password login', () => {
  let user: UserEntity;

  beforeEach(async () => {
    user = await saveUser({ identities: ['dana@example.com'], password: PASSWORD, roles: [admin] });
  });

  it('should issue an access token that verifies against the published active key', async () => {
    // Act
    const { access_token } = await login('dana@example.com');
    const { keys } = await authController.getJWKS(request({}));

    // Assert
    const decoded = jwt.decode(access_token, { complete: true });
    expect(decoded?.header).toMatchObject({ alg: 'ES256', kid: 'jwt-key-2' });
    const active = keys.find((key) => key.kid === decoded?.header.kid);
    const payload = jwt.verify(
      access_token,
      createPublicKey({ key: active as never, format: 'jwk' })
    ) as jwt.JwtPayload;
    expect(payload.user).toEqual({
      id: user.id,
      roles: [{ id: admin.id, name: 'admin', permissions: ['admin.all'] }],
      meta: {},
    });
  });

  it('should store only hashes of the identity, the password, the refresh token and its fingerprints', async () => {
    // Act
    const { refresh_token } = await login('dana@example.com', ['browser']);

    // Assert
    const [userRow] = await appDataSource.query<{ identities: string[]; password: string }[]>(
      'SELECT identities, password FROM users'
    );
    expect(userRow.identities).toEqual([sha256('dana@example.com')]);
    expect(userRow.password).not.toContain(PASSWORD);
    expect(userRow.password).toMatch(/^[0-9a-f]{64}$/);
    expect(await refreshTokenRows()).toEqual([
      { user_id: user.id, token: sha256(refresh_token), fingerprints: [sha256('browser')], revoked: false },
    ]);
  });

  it('should refuse a wrong password and an unknown identity', async () => {
    await expect(
      authController.createToken(request({ identity: 'dana@example.com', password: 'wrong' }))
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(login('nobody@example.com')).rejects.toBeInstanceOf(NotFoundError);
    expect(await refreshTokenRows()).toEqual([]);
  });
});

describe('MFA login', () => {
  beforeEach(async () => {
    await saveUser({ identities: ['dana@example.com'], password: PASSWORD, mfa_enabled: true, roles: [admin] });
  });

  it('should exchange the code for tokens once, and delete it', async () => {
    // Arrange
    const challenge = await authController.authenticate(request({ identity: 'dana@example.com', password: PASSWORD }));

    // Act
    const tokens = await authController.createToken(request(challenge));

    // Assert
    expect(tokens.access_token).toBeTruthy();
    expect(await appDataSource.query('SELECT id FROM auth_codes')).toEqual([]);
    await expect(authController.createToken(request(challenge))).rejects.toStrictEqual(
      new NotFoundError('Auth code not found')
    );
  });

  it('should refuse an expired code', async () => {
    const challenge = await authController.authenticate(request({ identity: 'dana@example.com' }));
    await expireAuthCode(challenge.challenge_id);

    await expect(authController.createToken(request(challenge))).rejects.toStrictEqual(
      new UnauthorizedError('MFA code expired')
    );
    expect(await refreshTokenRows()).toEqual([]);
  });

  it('should refuse a password login', async () => {
    await expect(login('dana@example.com')).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('refresh', () => {
  let user: UserEntity;
  let other: UserEntity;

  beforeEach(async () => {
    user = await saveUser({ identities: ['dana@example.com'], password: PASSWORD, roles: [admin] });
    other = await saveUser({ identities: ['noa@example.com'], password: PASSWORD, roles: [admin] });
  });

  it('should revoke the old token and issue a working new one', async () => {
    // Arrange
    const first = await login('dana@example.com');

    // Act
    const second = await authController.refreshToken(request({ refresh_token: first.refresh_token }));

    // Assert
    expect(await refreshTokenRows(user.id)).toEqual([
      expect.objectContaining({ token: sha256(first.refresh_token), revoked: true }),
      expect.objectContaining({ token: sha256(second.refresh_token), revoked: false }),
    ]);
    await expect(authController.refreshToken(request({ refresh_token: second.refresh_token }))).resolves.toHaveProperty(
      'access_token'
    );
  });

  it('should leave the old token unrevoked when the new one cannot be saved', async () => {
    // Arrange
    const { refresh_token } = await login('dana@example.com');
    const save = EntityManager.prototype.save;
    const failing = jest.spyOn(EntityManager.prototype, 'save').mockImplementation(async function (
      this: EntityManager,
      ...args: unknown[]
    ) {
      if (failing.mock.calls.length === 2) {
        throw new Error('insert failed');
      }
      return (save as (...a: unknown[]) => Promise<unknown>).apply(this, args);
    });

    // Act
    const rotation = authController.refreshToken(request({ refresh_token }));

    // Assert
    await expect(rotation).rejects.toThrow('insert failed');
    failing.mockRestore();
    expect((await refreshTokenRows(user.id)).map((row) => row.revoked)).toEqual([false]);
    await expect(authController.refreshToken(request({ refresh_token }))).resolves.toHaveProperty('access_token');
  });

  it("should revoke every token of the user, and no other user's, when a revoked token is used again", async () => {
    // Arrange
    const first = await login('dana@example.com');
    await login('dana@example.com');
    await login('noa@example.com');
    await authController.refreshToken(request({ refresh_token: first.refresh_token }));

    // Act
    const reuse = authController.refreshToken(request({ refresh_token: first.refresh_token }));

    // Assert
    await expect(reuse).rejects.toStrictEqual(new UnauthorizedError('Invalid refresh token'));
    expect((await refreshTokenRows(user.id)).map((row) => row.revoked)).toEqual([true, true, true]);
    expect((await refreshTokenRows(other.id)).map((row) => row.revoked)).toEqual([false]);
  });

  it('should refuse too few matching fingerprints and revoke the user tokens', async () => {
    const { refresh_token } = await login('dana@example.com', ['browser']);

    await expect(
      authController.refreshToken(request({ refresh_token, fingerprints: ['other'], min_fingerprints_to_match: 1 }))
    ).rejects.toStrictEqual(new UnauthorizedError('Fingerprints do not match'));
    expect((await refreshTokenRows(user.id)).map((row) => row.revoked)).toEqual([true]);
  });
});

describe('revoke', () => {
  it('should revoke a token once and refuse a second time', async () => {
    await saveUser({ identities: ['dana@example.com'], password: PASSWORD, roles: [admin] });
    const { refresh_token } = await login('dana@example.com');

    await authController.revokeToken(request({ refresh_token }));

    expect((await refreshTokenRows()).map((row) => row.revoked)).toEqual([true]);
    await expect(authController.revokeToken(request({ refresh_token }))).rejects.toStrictEqual(
      new BadRequestError('Token already revoked')
    );
  });
});

describe('inactive users', () => {
  let user: UserEntity;
  let other: UserEntity;

  beforeEach(async () => {
    user = await saveUser({ identities: ['dana@example.com'], password: PASSWORD, roles: [admin] });
    other = await saveUser({ identities: ['noa@example.com'], password: PASSWORD, roles: [admin] });
  });

  it("should revoke every token of a deactivated user, and no other user's", async () => {
    // Arrange
    await login('dana@example.com');
    await login('dana@example.com');
    await login('noa@example.com');

    // Act
    await userController.updateUser(request({ id: user.id, is_active: false }));

    // Assert
    expect((await refreshTokenRows(user.id)).map((row) => row.revoked)).toEqual([true, true]);
    expect((await refreshTokenRows(other.id)).map((row) => row.revoked)).toEqual([false]);
  });

  it('should leave the user active, and the tokens as they were, when the revocation fails', async () => {
    // Arrange
    await login('dana@example.com');
    jest.spyOn(EntityManager.prototype, 'update').mockRejectedValueOnce(new Error('deadlock detected'));

    // Act
    const deactivation = userController.updateUser(request({ id: user.id, is_active: false }));

    // Assert
    await expect(deactivation).rejects.toThrow('deadlock detected');
    const [row] = await appDataSource.query<{ is_active: boolean }[]>('SELECT is_active FROM users WHERE id = $1', [
      user.id,
    ]);
    expect(row.is_active).toBe(true);
    expect((await refreshTokenRows(user.id)).map((token) => token.revoked)).toEqual([false]);
  });

  it('should keep the tokens when an update leaves the user active', async () => {
    await login('dana@example.com');

    await userController.updateUser(request({ id: user.id, meta: { first_name: 'Dana' } }));
    await userController.updateUser(request({ id: user.id, is_active: true }));

    expect((await refreshTokenRows(user.id)).map((row) => row.revoked)).toEqual([false]);
  });

  it('should refuse a valid token of a user made inactive without an update, and revoke their tokens', async () => {
    // Arrange
    const { refresh_token } = await login('dana@example.com');
    await login('dana@example.com');
    await appDataSource.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

    // Act and Assert
    await expect(authController.refreshToken(request({ refresh_token }))).rejects.toStrictEqual(
      new UnauthorizedError('User is not active')
    );
    expect((await refreshTokenRows(user.id)).map((row) => row.revoked)).toEqual([true, true]);
  });

  it('should not bring old sessions back when the user is reactivated', async () => {
    const { refresh_token } = await login('dana@example.com');
    await userController.updateUser(request({ id: user.id, is_active: false }));

    await userController.updateUser(request({ id: user.id, is_active: true }));

    await expect(authController.refreshToken(request({ refresh_token }))).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(login('dana@example.com')).resolves.toHaveProperty('access_token');
  });

  it('should refuse an MFA code issued before the user was deactivated', async () => {
    await userController.updateUser(request({ id: user.id, mfa_enabled: true }));
    const challenge = await authController.authenticate(request({ identity: 'dana@example.com' }));
    await userController.updateUser(request({ id: user.id, is_active: false }));

    await expect(authController.createToken(request(challenge))).rejects.toStrictEqual(
      new BadRequestError('User is not active')
    );
    expect(await refreshTokenRows(user.id)).toEqual([]);
  });
});
