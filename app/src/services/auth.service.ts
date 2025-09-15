import jwt, { SignOptions, Algorithm } from 'jsonwebtoken';
import { randomBytes, createPublicKey, KeyObject } from 'crypto';
import { exportJWK } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { Repository, EntityManager } from 'typeorm';
import {
  AuthenticateDTO,
  DidAuthenticateDTO,
  CreateTokenDTO,
  CreateMFATokenDTO,
  DidCreateTokenDTO,
  RefreshTokenDTO,
  DidRefreshTokenDTO,
  RevokeTokenDTO,
  JWKSKey
} from 'iam-pkg';
import { UnauthorizedError, NotFoundError, BadRequestError } from 'rest-pkg';

import userService from '@/services/user.service';
import UserEntity from '@/entities/user/user.entity';
import AuthCodeEntity from '@/entities/auth/auth-code.entity';
import appDataSource from '@/config/db.config';
import RefreshTokenEntity from '@/entities/auth/refresh-token.entity';
import appConfig from '@/config/app.config';
import { keys, KeyEntry } from '@/config/keys.config';
import { sha256 } from '@/common/utils';

class AuthService {
  private refreshTokenRepository: Repository<RefreshTokenEntity> = appDataSource.getRepository(RefreshTokenEntity);
  private authCodeRepository: Repository<AuthCodeEntity> = appDataSource.getRepository(AuthCodeEntity);

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
    if (!data.password || user.password === userService.hashPassword(data.password)) {
      const authCode: AuthCodeEntity = await this.generateAndSaveAuthCode(user);
      return { challenge_id: authCode.challenge_id, mfa_code: authCode.mfa_code };
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
    } else if (!data.password || user.password !== userService.hashPassword(data.password)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return await this.createTokensForUser(user, data.fingerprints);
  }

  async createMFAToken(data: CreateMFATokenDTO): Promise<DidCreateTokenDTO> {
    const authCode: AuthCodeEntity = await this.findAuthCodeByCodeAndChallenge(data.mfa_code, data.challenge_id);
    if (authCode.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedError('MFA code expired');
    }

    if (!authCode.user.mfa_enabled) {
      throw new BadRequestError('MFA authentication disabled');
    }

    return await appDataSource.transaction(async (manager: EntityManager) => {
      // Delete the auth code, so it cannot be used again
      await this.deleteAuthCode(authCode, manager);

      // Create new access and refresh tokens
      return await this.createTokensForUser(authCode.user, data.fingerprints, manager);
    });
  }

  async findAuthCodeByCodeAndChallenge(mfaCode: string, challengeId: string): Promise<AuthCodeEntity> {
    const authCode: AuthCodeEntity | null = await this.authCodeRepository.findOne({ where: { mfa_code: mfaCode, challenge_id: challengeId } });
    if (!authCode) {
      throw new NotFoundError('Auth code not found');
    }

    return authCode;
  }

  async refreshToken(data: RefreshTokenDTO): Promise<DidRefreshTokenDTO> {
    const refreshToken: RefreshTokenEntity = await this.findRefreshTokenByToken(data.refresh_token);
    if (refreshToken.revoked || refreshToken.expires_at.getTime() < Date.now()) {
      await this.revokeAllRefreshTokensByUser(refreshToken.user_id);

      //TODO: in the future we can notify the user about this as a potential breach

      throw new UnauthorizedError('Invalid refresh token');
    }

    const minFingerprintsToMatch: number = Math.max(0, data.min_fingerprints_to_match ?? 0);
    if (minFingerprintsToMatch > 0) {
      const fingerprints: string[] = data.fingerprints ?? [];

      const fingerprintMatches = fingerprints.filter(fp =>
        refreshToken.fingerprints.includes(sha256(fp))
      ).length;

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
    const refreshToken: RefreshTokenEntity | null = await this.refreshTokenRepository.findOne({ where: { token: sha256(token) } });
    if (!refreshToken) {
      throw new NotFoundError('Refresh token not found');
    }

    return refreshToken;
  }

  async revokeToken(data: RevokeTokenDTO): Promise<void> {
    const token: string = sha256(data.refresh_token);
    const refreshToken: RefreshTokenEntity = await this.findRefreshTokenByToken(token);
    if (refreshToken.revoked) {
      throw new BadRequestError('Token already revoked');
    }

    refreshToken.revoked = true;
    await refreshToken.save();
  }

  async revokeAllRefreshTokensByUser(userId: string) {
    await this.refreshTokenRepository.update(
      { user_id: userId },
      { revoked: true }
    );
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

  private async createTokensForUser(user: UserEntity, fingerprints?: string[], manager?: EntityManager): Promise<DidCreateTokenDTO> {
    const accessToken: string = this.generateAccessToken(user);
    const refreshToken: string = this.generateRefreshToken();
    await this.saveRefreshToken(refreshToken, user, fingerprints, manager);

    return {
      access_token: accessToken,
      refresh_token: refreshToken
    }
  }

  private generateAccessToken(user: UserEntity): string {
    const activeKey = keys[keys.length - 1];

    const options: SignOptions = {
      algorithm: activeKey.alg as Algorithm,
      keyid: activeKey.kid,
      expiresIn: appConfig.auth.access_token_expires_in,
      jwtid: uuidv4(),
    };

    return jwt.sign(
      { user: user.output() },
      activeKey.privateKey,
      options
    );
  }

  private generateRefreshToken(length = 64): string {
    return randomBytes(length).toString('hex');
  }

  private async revokeRefreshToken(refreshToken: RefreshTokenEntity, manager?: EntityManager): Promise<void> {
    refreshToken.revoked = true;
    await (manager ? manager.save(refreshToken) : refreshToken.save());
  }

  private async saveRefreshToken(token: string, user: UserEntity, fingerprints?: string[], manager?: EntityManager): Promise<void> {
    const refreshToken = new RefreshTokenEntity();
    refreshToken.user_id = user.id;
    refreshToken.token = sha256(token);
    refreshToken.expires_at = new Date(Date.now() + 1000 * appConfig.auth.refresh_token_expires_in);
    refreshToken.fingerprints = fingerprints ? fingerprints.map(fingerprint => sha256(fingerprint)) : [];
    await (manager ? manager.save(refreshToken) : refreshToken.save());
  }

  private async deleteAuthCode(authCode: AuthCodeEntity, manager?: EntityManager): Promise<void> {
    await (manager ? manager.remove(authCode) : this.authCodeRepository.remove(authCode));
  }

  private async generateAndSaveAuthCode(user: UserEntity): Promise<AuthCodeEntity> {
    let code: string = '';
    while (1) {
      code = this.generateRandomString(appConfig.auth.auth_code_length);
      const codeExists: AuthCodeEntity | null = await this.authCodeRepository.findOne({ where: { mfa_code: code, user_id: user.id } });
      if (!codeExists) {
        break;
      }
    }

    const authCode = new AuthCodeEntity();
    authCode.expires_at = new Date(Date.now() + 1000 * appConfig.auth.auth_code_expires_in);
    authCode.user_id = user.id;
    authCode.mfa_code = code;
    authCode.challenge_id = this.generateRandomString(appConfig.auth.auth_code_length);
    await authCode.save();

    return authCode;
  }

  private generateRandomString(length = 6): string {
    const bytes = Math.ceil(length * 3 / 4); // base64 expands 3 bytes into 4 chars
    return randomBytes(bytes).toString('base64url').slice(0, length);
  }
}

export default new AuthService();
