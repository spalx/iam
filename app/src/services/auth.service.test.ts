import { createHash, createPublicKey } from 'crypto';
import jwt, { JwtHeader, JwtPayload } from 'jsonwebtoken';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import { keys } from '@/config/keys.config';
import AuthCodeEntity from '@/entities/auth/auth-code.entity';
import RefreshTokenEntity from '@/entities/auth/refresh-token.entity';
import RoleEntity from '@/entities/user/role.entity';
import UserEntity from '@/entities/user/user.entity';
import userService from '@/services/user.service';
import authService from './auth.service';

jest.mock('@/common/db/app-data-source', () => ({
  __esModule: true,
  default: { getRepository: jest.fn(), transaction: jest.fn() },
}));

const NOW = new Date('2026-10-19T10:00:00.000Z');
const PASSWORD = 'correct horse';

const refreshTokenRepository = { findOne: jest.fn(), update: jest.fn() };
const authCodeRepository = { findOne: jest.fn(), remove: jest.fn() };
const manager = { save: jest.fn(), remove: jest.fn() };
let refreshTokenSave: jest.SpyInstance;
let authCodeSave: jest.SpyInstance;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const role = Object.assign(new RoleEntity(), { id: 'role-1', name: 'admin', permissions: ['admin.all'] });
  return Object.assign(new UserEntity(), {
    id: 'user-1',
    identities: [sha256('dana@example.com')],
    password: userService.hashPassword(PASSWORD),
    is_active: true,
    mfa_enabled: false,
    roles: [role],
    meta: { first_name: 'Dana' },
    ...overrides,
  });
}

function buildRefreshToken(overrides: Partial<RefreshTokenEntity> = {}): RefreshTokenEntity {
  const user = buildUser();
  return Object.assign(new RefreshTokenEntity(), {
    id: 'token-1',
    user_id: user.id,
    user,
    token: sha256('presented-token'),
    fingerprints: [sha256('browser'), sha256('device')],
    expires_at: new Date(NOW.getTime() + 60_000),
    revoked: false,
    ...overrides,
  });
}

function buildAuthCode(overrides: Partial<AuthCodeEntity> = {}): AuthCodeEntity {
  const user = buildUser({ mfa_enabled: true });
  return Object.assign(new AuthCodeEntity(), {
    id: 'code-1',
    user_id: user.id,
    user,
    mfa_code: '654321',
    challenge_id: 'abc123',
    expires_at: new Date(NOW.getTime() + 45_000),
    ...overrides,
  });
}

function decode(token: string): { header: JwtHeader; payload: JwtPayload } {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded.payload === 'string') {
    throw new Error('not a JWT');
  }
  return { header: decoded.header, payload: decoded.payload };
}

// The refresh token saved through the transaction's manager, or directly when there is no transaction.
function savedRefreshToken(): RefreshTokenEntity {
  const saved = [...manager.save.mock.calls.map(([entity]) => entity), ...refreshTokenSave.mock.instances].filter(
    (entity: unknown) => entity instanceof RefreshTokenEntity && (entity as RefreshTokenEntity).id === undefined
  );
  expect(saved).toHaveLength(1);
  return saved[0] as RefreshTokenEntity;
}

beforeEach(() => {
  // Drops any one-off value a test arranged and didn't use.
  [...Object.values(refreshTokenRepository), ...Object.values(authCodeRepository), ...Object.values(manager)].forEach(
    (mock) => mock.mockReset()
  );
  // The real password hashing, with the user lookup replaced.
  jest.spyOn(userService, 'findUserByIdentity').mockRejectedValue(new Error('findUserByIdentity not arranged'));
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest
    .mocked(appDataSource.getRepository)
    .mockImplementation(((target: unknown) =>
      target === RefreshTokenEntity ? refreshTokenRepository : authCodeRepository) as never);
  jest.mocked(appDataSource.transaction).mockImplementation(async (run) => run(manager as never) as never);
  refreshTokenSave = jest.spyOn(RefreshTokenEntity.prototype, 'save').mockImplementation(async function (this: never) {
    return this;
  });
  authCodeSave = jest.spyOn(AuthCodeEntity.prototype, 'save').mockImplementation(async function (this: never) {
    return this;
  });
  manager.save.mockImplementation(async (entity: unknown) => entity);
  authCodeRepository.findOne.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AuthService - getJWKS', () => {
  it('should publish the public half of the old and the active key, as ES256 signing keys', async () => {
    // Act
    const jwks = await authService.getJWKS();

    // Assert
    expect(jwks.map((key) => key.kid)).toEqual(['jwt-key-1', 'jwt-key-2']);
    for (const key of jwks) {
      expect(key).toMatchObject({ alg: 'ES256', use: 'sig', kty: 'EC', crv: 'P-256' });
      expect(key).not.toHaveProperty('d');
    }
    expect(jwks[0].x).not.toBe(jwks[1].x);
  });

  it('should publish each key as its configured public key', async () => {
    const jwks = await authService.getJWKS();

    jwks.forEach((key, index) => {
      expect(createPublicKey({ key: key as never, format: 'jwk' }).export({ type: 'spki', format: 'pem' })).toBe(
        keys[index].publicKey
      );
    });
  });
});

describe('AuthService - createToken', () => {
  describe('should_issue_tokens_when_an_active_user_without_mfa_gives_the_right_password', () => {
    it('should sign an access token with the active key, carrying the user output', async () => {
      // Arrange
      const user = buildUser();
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(user);

      // Act
      const { access_token } = await authService.createToken({ identity: 'dana@example.com', password: PASSWORD });

      // Assert
      const { header, payload } = decode(access_token);
      expect(header).toMatchObject({ alg: 'ES256', kid: 'jwt-key-2' });
      expect(payload.user).toEqual(user.output());
      expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
      expect(payload.iat).toBe(NOW.getTime() / 1000);
      expect(payload.exp).toBe(NOW.getTime() / 1000 + 900);
      expect(() => jwt.verify(access_token, keys[1].publicKey, { algorithms: ['ES256'] })).not.toThrow();
      expect(() => jwt.verify(access_token, keys[0].publicKey, { algorithms: ['ES256'] })).toThrow('invalid signature');
    });

    it('should verify against the published active key and no other', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser());
      const { access_token } = await authService.createToken({ identity: 'dana@example.com', password: PASSWORD });

      const jwks = await authService.getJWKS();

      const [active] = jwks.filter((key) => key.kid === decode(access_token).header.kid);
      const others = jwks.filter((key) => key !== active);
      expect(() => jwt.verify(access_token, createPublicKey({ key: active as never, format: 'jwk' }))).not.toThrow();
      for (const key of others) {
        expect(() => jwt.verify(access_token, createPublicKey({ key: key as never, format: 'jwk' }))).toThrow();
      }
    });

    it('should save only hashes of the refresh token and its fingerprints, expiring in a week', async () => {
      // Arrange
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser());

      // Act
      const { refresh_token } = await authService.createToken({
        identity: 'dana@example.com',
        password: PASSWORD,
        fingerprints: ['browser', 'device'],
      });

      // Assert
      expect(refresh_token).toMatch(/^[0-9a-f]{128}$/);
      const saved = savedRefreshToken();
      expect(saved).toMatchObject({
        user_id: 'user-1',
        token: sha256(refresh_token),
        fingerprints: [sha256('browser'), sha256('device')],
        expires_at: new Date(NOW.getTime() + 604800 * 1000),
      });
      expect(appDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should save no fingerprints when none are given', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser());

      await authService.createToken({ identity: 'dana@example.com', password: PASSWORD });

      expect(savedRefreshToken().fingerprints).toEqual([]);
    });

    it('should issue a different refresh token each time', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValue(buildUser());

      const first = await authService.createToken({ identity: 'dana@example.com', password: PASSWORD });
      const second = await authService.createToken({ identity: 'dana@example.com', password: PASSWORD });

      expect(first.refresh_token).not.toBe(second.refresh_token);
      expect(decode(first.access_token).payload.jti).not.toBe(decode(second.access_token).payload.jti);
    });
  });

  describe('should_refuse_when_the_user_cannot_sign_in_with_a_password', () => {
    it('should pass on that the identity is unknown', async () => {
      const error = new NotFoundError('User not found');
      jest.mocked(userService.findUserByIdentity).mockRejectedValueOnce(error);

      await expect(authService.createToken({ identity: 'nobody@example.com', password: PASSWORD })).rejects.toBe(error);
    });

    it('should refuse an inactive user, even with the right password', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser({ is_active: false }));

      await expect(authService.createToken({ identity: 'dana@example.com', password: PASSWORD })).rejects.toStrictEqual(
        new BadRequestError('User is not active')
      );
      expect(refreshTokenSave).not.toHaveBeenCalled();
    });

    it('should refuse a user with MFA on', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser({ mfa_enabled: true }));

      await expect(authService.createToken({ identity: 'dana@example.com', password: PASSWORD })).rejects.toStrictEqual(
        new BadRequestError('MFA authentication enabled, challenge_id and mfa_code must be provided')
      );
    });

    it.each([undefined, '', 'wrong'])('should refuse the password %p', async (password) => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser());

      await expect(authService.createToken({ identity: 'dana@example.com', password })).rejects.toStrictEqual(
        new UnauthorizedError('Invalid credentials')
      );
      expect(refreshTokenSave).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService - authenticate', () => {
  describe('should_issue_a_code_and_challenge_when_an_active_mfa_user_may_sign_in', () => {
    it.each([PASSWORD, undefined])('should save and return a code for the password %p', async (password) => {
      // Arrange
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser({ mfa_enabled: true }));

      // Act
      const result = await authService.authenticate({ identity: 'dana@example.com', password });

      // Assert
      expect(result.mfa_code).toMatch(/^[A-Za-z0-9_-]{6}$/);
      expect(result.challenge_id).toMatch(/^[A-Za-z0-9_-]{6}$/);
      expect(authCodeSave).toHaveBeenCalledTimes(1);
      expect(authCodeSave.mock.instances[0]).toMatchObject({
        user_id: 'user-1',
        mfa_code: result.mfa_code,
        challenge_id: result.challenge_id,
        expires_at: new Date(NOW.getTime() + 45 * 1000),
      });
    });

    it('should generate another code when the user already has the one drawn', async () => {
      // Arrange
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser({ mfa_enabled: true }));
      authCodeRepository.findOne.mockResolvedValueOnce(buildAuthCode()).mockResolvedValueOnce(null);

      // Act
      const result = await authService.authenticate({ identity: 'dana@example.com', password: PASSWORD });

      // Assert
      expect(authCodeRepository.findOne).toHaveBeenCalledTimes(2);
      const [first, second] = authCodeRepository.findOne.mock.calls.map(([options]) => options.where);
      expect(first).toEqual({ mfa_code: expect.any(String), user_id: 'user-1' });
      expect(second).toEqual({ mfa_code: result.mfa_code, user_id: 'user-1' });
    });
  });

  describe('should_refuse_when_the_user_cannot_get_a_code', () => {
    it('should refuse an inactive user', async () => {
      jest
        .mocked(userService.findUserByIdentity)
        .mockResolvedValueOnce(buildUser({ is_active: false, mfa_enabled: true }));

      await expect(authService.authenticate({ identity: 'dana@example.com' })).rejects.toStrictEqual(
        new BadRequestError('User is not active')
      );
    });

    it('should refuse a user with MFA off', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser());

      await expect(authService.authenticate({ identity: 'dana@example.com' })).rejects.toStrictEqual(
        new BadRequestError('MFA authentication disabled')
      );
    });

    it('should refuse a wrong password and save no code', async () => {
      jest.mocked(userService.findUserByIdentity).mockResolvedValueOnce(buildUser({ mfa_enabled: true }));

      await expect(authService.authenticate({ identity: 'dana@example.com', password: 'wrong' })).rejects.toStrictEqual(
        new UnauthorizedError('Invalid credentials')
      );
      expect(authCodeSave).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService - createMFAToken', () => {
  it('should delete the code and save the new refresh token in one transaction', async () => {
    // Arrange
    const authCode = buildAuthCode();
    authCodeRepository.findOne.mockResolvedValueOnce(authCode);

    // Act
    const result = await authService.createMFAToken({
      challenge_id: 'abc123',
      mfa_code: '654321',
      fingerprints: ['browser'],
    });

    // Assert
    expect(authCodeRepository.findOne).toHaveBeenCalledWith({ where: { mfa_code: '654321', challenge_id: 'abc123' } });
    expect(appDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.remove).toHaveBeenCalledWith(authCode);
    expect(savedRefreshToken()).toMatchObject({
      token: sha256(result.refresh_token),
      fingerprints: [sha256('browser')],
    });
    expect(refreshTokenSave).not.toHaveBeenCalled();
    expect(decode(result.access_token).payload.user).toEqual(authCode.user.output());
  });

  it('should refuse an unknown code', async () => {
    await expect(authService.createMFAToken({ challenge_id: 'abc123', mfa_code: '000000' })).rejects.toStrictEqual(
      new NotFoundError('Auth code not found')
    );
  });

  it('should refuse an expired code', async () => {
    authCodeRepository.findOne.mockResolvedValueOnce(buildAuthCode({ expires_at: new Date(NOW.getTime() - 1) }));

    await expect(authService.createMFAToken({ challenge_id: 'abc123', mfa_code: '654321' })).rejects.toStrictEqual(
      new UnauthorizedError('MFA code expired')
    );
    expect(manager.remove).not.toHaveBeenCalled();
  });

  it('should refuse a code whose user has since turned MFA off', async () => {
    authCodeRepository.findOne.mockResolvedValueOnce(buildAuthCode({ user: buildUser({ mfa_enabled: false }) }));

    await expect(authService.createMFAToken({ challenge_id: 'abc123', mfa_code: '654321' })).rejects.toStrictEqual(
      new BadRequestError('MFA authentication disabled')
    );
    expect(appDataSource.transaction).not.toHaveBeenCalled();
  });

  it('should refuse a code whose user has since been deactivated, and issue no token', async () => {
    authCodeRepository.findOne.mockResolvedValueOnce(
      buildAuthCode({ user: buildUser({ mfa_enabled: true, is_active: false }) })
    );

    await expect(authService.createMFAToken({ challenge_id: 'abc123', mfa_code: '654321' })).rejects.toStrictEqual(
      new BadRequestError('User is not active')
    );
    expect(appDataSource.transaction).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('AuthService - refreshToken', () => {
  describe('should_rotate_the_token_when_it_is_valid', () => {
    it('should revoke the old token and save the new one in one transaction', async () => {
      // Arrange
      const old = buildRefreshToken();
      refreshTokenRepository.findOne.mockResolvedValueOnce(old);

      // Act
      const result = await authService.refreshToken({ refresh_token: 'presented-token', fingerprints: ['browser'] });

      // Assert
      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { token: sha256('presented-token') } });
      expect(appDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledWith(old);
      expect(old.revoked).toBe(true);
      expect(savedRefreshToken()).toMatchObject({
        token: sha256(result.refresh_token),
        fingerprints: [sha256('browser')],
      });
      expect(refreshTokenSave).not.toHaveBeenCalled();
      expect(refreshTokenRepository.update).not.toHaveBeenCalled();
      expect(decode(result.access_token).payload.user).toEqual(old.user.output());
    });

    it.each([
      [1, ['browser']],
      [2, ['browser', 'device', 'other']],
      [0, []],
      [-3, undefined],
    ])('should accept %p required matches against %p', async (min, fingerprints) => {
      refreshTokenRepository.findOne.mockResolvedValueOnce(buildRefreshToken());

      await expect(
        authService.refreshToken({ refresh_token: 'presented-token', fingerprints, min_fingerprints_to_match: min })
      ).resolves.toHaveProperty('access_token');
    });
  });

  describe('should_refuse_and_revoke_every_token_of_the_user_when_the_token_looks_stolen', () => {
    it.each([
      ['revoked', { revoked: true }],
      ['expired', { expires_at: new Date(NOW.getTime() - 1) }],
    ])('should refuse a %s token', async (_name, overrides) => {
      // Arrange
      refreshTokenRepository.findOne.mockResolvedValueOnce(buildRefreshToken(overrides));

      // Act and Assert
      await expect(authService.refreshToken({ refresh_token: 'presented-token' })).rejects.toStrictEqual(
        new UnauthorizedError('Invalid refresh token')
      );
      expect(refreshTokenRepository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, { revoked: true });
      expect(appDataSource.transaction).not.toHaveBeenCalled();
    });

    it.each([
      [2, ['browser']],
      [1, []],
      [1, undefined],
      [1, ['unknown']],
    ])('should refuse when %p matches are required and %p are given', async (min, fingerprints) => {
      refreshTokenRepository.findOne.mockResolvedValueOnce(buildRefreshToken());

      await expect(
        authService.refreshToken({ refresh_token: 'presented-token', fingerprints, min_fingerprints_to_match: min })
      ).rejects.toStrictEqual(new UnauthorizedError('Fingerprints do not match'));
      expect(refreshTokenRepository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, { revoked: true });
      expect(appDataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('should_refuse_and_revoke_every_token_of_the_user_when_the_user_is_inactive', () => {
    it('should refuse a valid token whose user is inactive, and issue no token', async () => {
      // Arrange
      const token = buildRefreshToken({ user: buildUser({ is_active: false }) });
      refreshTokenRepository.findOne.mockResolvedValueOnce(token);

      // Act and Assert
      await expect(authService.refreshToken({ refresh_token: 'presented-token' })).rejects.toStrictEqual(
        new UnauthorizedError('User is not active')
      );
      expect(refreshTokenRepository.update).toHaveBeenCalledWith({ user_id: 'user-1' }, { revoked: true });
      expect(appDataSource.transaction).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('should refuse an inactive user before checking fingerprints', async () => {
      refreshTokenRepository.findOne.mockResolvedValueOnce(
        buildRefreshToken({ user: buildUser({ is_active: false }) })
      );

      await expect(
        authService.refreshToken({ refresh_token: 'presented-token', fingerprints: [], min_fingerprints_to_match: 1 })
      ).rejects.toStrictEqual(new UnauthorizedError('User is not active'));
    });
  });

  it('should refuse an unknown token', async () => {
    refreshTokenRepository.findOne.mockResolvedValueOnce(null);

    await expect(authService.refreshToken({ refresh_token: 'unknown' })).rejects.toStrictEqual(
      new NotFoundError('Refresh token not found')
    );
  });
});

describe('AuthService - revokeToken', () => {
  it('should mark the token revoked', async () => {
    const token = buildRefreshToken();
    refreshTokenRepository.findOne.mockResolvedValueOnce(token);

    await authService.revokeToken({ refresh_token: 'presented-token' });

    expect(token.revoked).toBe(true);
    expect(refreshTokenSave.mock.instances).toEqual([token]);
  });

  it('should refuse a token that is already revoked', async () => {
    refreshTokenRepository.findOne.mockResolvedValueOnce(buildRefreshToken({ revoked: true }));

    await expect(authService.revokeToken({ refresh_token: 'presented-token' })).rejects.toStrictEqual(
      new BadRequestError('Token already revoked')
    );
    expect(refreshTokenSave).not.toHaveBeenCalled();
  });

  it('should refuse an unknown token', async () => {
    refreshTokenRepository.findOne.mockResolvedValueOnce(null);

    await expect(authService.revokeToken({ refresh_token: 'unknown' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
