import {
  AuthenticateDTO,
  DidAuthenticateDTO,
  AuthenticateDTOSchema,
  CreateTokenDTO,
  CreateMFATokenDTO,
  DidCreateTokenDTO,
  CreateTokenDTOSchema,
  CreateMFATokenDTOSchema,
  RefreshTokenDTO,
  DidRefreshTokenDTO,
  RefreshTokenDTOSchema,
  RevokeTokenDTO,
  DidRevokeTokenDTO,
  RevokeTokenDTOSchema,
  GetJWKSDTO,
  DidGetJWKSDTO,
} from 'iam-pkg';
import { CorrelatedRequestDTO, CorrelatedRequestDTOSchema, transportService } from 'transport-pkg';

import authService from '@/services/auth.service';

class AuthController {
  async getJWKS(dto: CorrelatedRequestDTO<GetJWKSDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: DidGetJWKSDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);

      const keys = await authService.getJWKS();
      responseData = { keys };
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async authenticate(dto: CorrelatedRequestDTO<AuthenticateDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: DidAuthenticateDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      AuthenticateDTOSchema.parse(dto.data);

      responseData = await authService.authenticate(dto.data);
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async createToken(dto: CorrelatedRequestDTO<CreateTokenDTO | CreateMFATokenDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: DidCreateTokenDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      if ('challenge_id' in dto.data && 'mfa_code' in dto.data) {
        CreateMFATokenDTOSchema.parse(dto.data);
        responseData = await authService.createMFAToken(dto.data);
      } else {
        CreateTokenDTOSchema.parse(dto.data);
        responseData = await authService.createToken(dto.data);
      }
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async refreshToken(dto: CorrelatedRequestDTO<RefreshTokenDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: DidRefreshTokenDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      RefreshTokenDTOSchema.parse(dto.data);

      responseData = await authService.refreshToken(dto.data);
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async revokeToken(dto: CorrelatedRequestDTO<RevokeTokenDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: DidRevokeTokenDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      RevokeTokenDTOSchema.parse(dto.data);

      responseData = await authService.revokeToken(dto.data);
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }
}

export default new AuthController();
