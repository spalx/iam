import jwt, { SignOptions, Algorithm } from 'jsonwebtoken';
import { randomBytes, createPublicKey, KeyObject } from 'crypto';
import { exportJWK } from 'jose';
import { Repository, EntityManager, LessThan } from 'typeorm';
import {
  AuthenticateDTO,
  DidAuthenticateDTO,
  CreateTokenDTO,
  CreateMFATokenDTO,
  DidCreateTokenDTO,
  RefreshTokenDTO,
  DidRefreshTokenDTO,
  RevokeTokenDTO,
  JWKSKey,
} from '@spalx/iam-pkg';
import { UnauthorizedError, NotFoundError, BadRequestError } from '@spalx/rest-pkg';

import userService from '@/services/user.service';
import UserEntity from '@/entities/user/user.entity';
import AuthCodeEntity from '@/entities/auth/auth-code.entity';
import appDataSource from '@/common/db/app-data-source';
import RefreshTokenEntity from '@/entities/auth/refresh-token.entity';
import appConfig from '@/config/app.config';
import { keys, KeyEntry } from '@/config/keys.config';
import { generateUuid, sha256 } from '@/common/utils';
import { authCodeMatches, hashAuthCode } from '@/common/auth-code-hash';

// 32 random bytes: a challenge id that cannot be guessed, whatever the code's length
const CHALLENGE_ID_BYTES = 32;

interface ReservedTry {
  id: string;
  code_hash: string;
  attempts: number;
}

class AuthService {
  private get refreshTokenRepository(): Repository<RefreshTokenEntity> {
    return appDataSource.getRepository(RefreshTokenEntity);
  }

  private get authCodeRepository(): Repository<AuthCodeEntity> {
    return appDataSource.getRepository(AuthCodeEntity);
  }

  async getJWKS(): Promise<JWKSKey[]> {
    return await Promise.all(keys.map(this.toJWK));
  }

  async authenticate(data: AuthenticateDTO): Promise<DidAuthenticateDTO> {
    const user: UserEntity = await userService.findUserByIdentity(data.identity);

    if (!user.is_active) {
      throw new BadRequestError('User is not active');
    }

    if (!user.mfa_enabled) {
      throw new BadRequestError('MFA authentication disabled');
    }

    // Password is optional, but is insecure if not passed
    if (!data.password || (await userService.checkPassword(user, data.password))) {
      return await this.generateAndSaveAuthCode(user);
    }

    throw new UnauthorizedError('Invalid credentials');
  }

  async createToken(data: CreateTokenDTO): Promise<DidCreateTokenDTO> {
    const user: UserEntity = await userService.findUserByIdentity(data.identity);

    if (!user.is_active) {
      throw new BadRequestError('User is not active');
    }

    if (user.mfa_enabled) {
      throw new BadRequestError('MFA authentication enabled, challenge_id and mfa_code must be provided');
    } else if (!data.password || !(await userService.checkPassword(user, data.password))) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return await this.createTokensForUser(user, data.fingerprints);
  }

  async createMFAToken(data: CreateMFATokenDTO): Promise<DidCreateTokenDTO> {
    const reservedTry: ReservedTry | undefined = await this.reserveTry(data.challenge_id);
    if (!reservedTry) {
      throw new NotFoundError('Auth code not found');
    }

    if (!authCodeMatches(data.challenge_id, data.mfa_code, reservedTry.code_hash)) {
      if (reservedTry.attempts >= appConfig.auth.auth_code_max_attempts) {
        // That was the last wrong code this challenge allows
        await this.authCodeRepository.delete({ id: reservedTry.id });
      }
      throw new NotFoundError('Auth code not found');
    }

    const authCode: AuthCodeEntity | null = await this.authCodeRepository.findOne({ where: { id: reservedTry.id } });
    if (!authCode) {
      throw new NotFoundError('Auth code not found');
    }

    if (authCode.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedError('MFA code expired');
    }

    if (!authCode.user.is_active) {
      throw new BadRequestError('User is not active');
    }

    if (!authCode.user.mfa_enabled) {
      throw new BadRequestError('MFA authentication disabled');
    }

    return await appDataSource.transaction(async (manager: EntityManager) => {
      // Only the request that deletes the code may use it, so two at once can't both get tokens
      const { affected } = await manager.delete(AuthCodeEntity, { id: authCode.id });
      if (affected !== 1) {
        throw new NotFoundError('Auth code not found');
      }

      return await this.createTokensForUser(authCode.user, data.fingerprints, manager);
    });
  }

  // Counts one more try of the challenge, unless it has used them all. The count goes up before the code is compared,
  // in one statement, so codes tried at the same time can't get past the limit.
  private async reserveTry(challengeId: string): Promise<ReservedTry | undefined> {
    const result = await this.authCodeRepository
      .createQueryBuilder()
      .update(AuthCodeEntity)
      .set({ attempts: () => 'attempts + 1' })
      .where('challenge_id = :challengeId AND attempts < :maxAttempts', {
        challengeId,
        maxAttempts: appConfig.auth.auth_code_max_attempts,
      })
      .returning(['id', 'code_hash', 'attempts'])
      .execute();

    return (result.raw as ReservedTry[])[0];
  }

  async refreshToken(data: RefreshTokenDTO): Promise<DidRefreshTokenDTO> {
    const refreshToken: RefreshTokenEntity = await this.findRefreshTokenByToken(data.refresh_token);
    if (refreshToken.revoked || refreshToken.expires_at.getTime() < Date.now()) {
      await this.revokeAllRefreshTokensByUser(refreshToken.user_id);

      //TODO: in the future we can notify the user about this as a potential breach

      throw new UnauthorizedError('Invalid refresh token');
    }

    // Unauthorized rather than a bad request: callers end the session on it instead of retrying
    if (!refreshToken.user.is_active) {
      await this.revokeAllRefreshTokensByUser(refreshToken.user_id);
      throw new UnauthorizedError('User is not active');
    }

    const minFingerprintsToMatch: number = Math.max(0, data.min_fingerprints_to_match ?? 0);
    if (minFingerprintsToMatch > 0) {
      const fingerprints: string[] = data.fingerprints ?? [];

      const fingerprintMatches = fingerprints.filter((fp) => refreshToken.fingerprints.includes(sha256(fp))).length;

      if (fingerprintMatches < minFingerprintsToMatch) {
        await this.revokeAllRefreshTokensByUser(refreshToken.user_id);

        //TODO: in the future we can notify the user about this as a potential breach

        throw new UnauthorizedError('Fingerprints do not match');
      }
    }

    return await appDataSource.transaction(async (manager: EntityManager) => {
      // Revoke old refresh token
      await this.revokeRefreshToken(refreshToken, manager);

      // Create new access and refresh tokens
      return await this.createTokensForUser(refreshToken.user, data.fingerprints, manager);
    });
  }

  async findRefreshTokenByToken(token: string): Promise<RefreshTokenEntity> {
    const refreshToken: RefreshTokenEntity | null = await this.refreshTokenRepository.findOne({
      where: { token: sha256(token) },
    });
    if (!refreshToken) {
      throw new NotFoundError('Refresh token not found');
    }

    return refreshToken;
  }

  async revokeToken(data: RevokeTokenDTO): Promise<void> {
    const refreshToken: RefreshTokenEntity = await this.findRefreshTokenByToken(data.refresh_token);
    if (refreshToken.revoked) {
      throw new BadRequestError('Token already revoked');
    }

    refreshToken.revoked = true;
    await refreshToken.save();
  }

  async revokeAllRefreshTokensByUser(userId: string) {
    await this.refreshTokenRepository.update({ user_id: userId }, { revoked: true });
  }

  private async toJWK(key: KeyEntry): Promise<JWKSKey> {
    const keyObject: KeyObject = createPublicKey(key.publicKey);
    const jwk = await exportJWK(keyObject);
    return {
      ...jwk,
      kid: key.kid,
      alg: key.alg,
      use: 'sig',
    };
  }

  private async createTokensForUser(
    user: UserEntity,
    fingerprints?: string[],
    manager?: EntityManager
  ): Promise<DidCreateTokenDTO> {
    const accessToken: string = this.generateAccessToken(user);
    const refreshToken: string = this.generateRefreshToken();
    await this.saveRefreshToken(refreshToken, user, fingerprints, manager);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private generateAccessToken(user: UserEntity): string {
    const activeKey = keys[keys.length - 1];

    const options: SignOptions = {
      algorithm: activeKey.alg as Algorithm,
      keyid: activeKey.kid,
      expiresIn: appConfig.auth.access_token_expires_in,
      jwtid: generateUuid(),
    };

    return jwt.sign({ user: user.output() }, activeKey.privateKey, options);
  }

  private generateRefreshToken(length = 64): string {
    return randomBytes(length).toString('hex');
  }

  private async revokeRefreshToken(refreshToken: RefreshTokenEntity, manager?: EntityManager): Promise<void> {
    refreshToken.revoked = true;
    await (manager ? manager.save(refreshToken) : refreshToken.save());
  }

  private async saveRefreshToken(
    token: string,
    user: UserEntity,
    fingerprints?: string[],
    manager?: EntityManager
  ): Promise<void> {
    const refreshToken = new RefreshTokenEntity();
    refreshToken.user_id = user.id;
    refreshToken.token = sha256(token);
    refreshToken.expires_at = new Date(Date.now() + 1000 * appConfig.auth.refresh_token_expires_in);
    refreshToken.fingerprints = fingerprints ? fingerprints.map((fingerprint) => sha256(fingerprint)) : [];
    await (manager ? manager.save(refreshToken) : refreshToken.save());
  }

  private async generateAndSaveAuthCode(user: UserEntity): Promise<DidAuthenticateDTO> {
    // Judged by IAM's clock, which set the expiry: the database's may run in another zone
    await this.authCodeRepository.delete({ expires_at: LessThan(new Date()) });

    const code = this.generateRandomString(appConfig.auth.auth_code_length);
    const challengeId = randomBytes(CHALLENGE_ID_BYTES).toString('base64url');

    const authCode = new AuthCodeEntity();
    authCode.expires_at = new Date(Date.now() + 1000 * appConfig.auth.auth_code_expires_in);
    authCode.user_id = user.id;
    authCode.code_hash = hashAuthCode(challengeId, code);
    authCode.challenge_id = challengeId;
    authCode.attempts = 0;
    await authCode.save();

    // The only time the code is readable: the caller delivers it
    return { challenge_id: challengeId, mfa_code: code };
  }

  private generateRandomString(length = 6): string {
    const bytes = Math.ceil((length * 3) / 4); // base64 expands 3 bytes into 4 chars
    return randomBytes(bytes).toString('base64url').slice(0, length);
  }
}

export default new AuthService();
