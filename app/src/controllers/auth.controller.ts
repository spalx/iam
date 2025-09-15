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
  RevokeTokenDTOSchema,
  GetJWKSDTO,
  DidGetJWKSDTO,
} from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import authService from '@/services/auth.service';

class AuthController {
  async getJWKS(req: CorrelatedMessage<GetJWKSDTO>): Promise<DidGetJWKSDTO> {
    const keys = await authService.getJWKS();
    return { keys };
  }

  async authenticate(req: CorrelatedMessage<AuthenticateDTO>): Promise<DidAuthenticateDTO> {
    AuthenticateDTOSchema.parse(req.data);

    return await authService.authenticate(req.data);
  }

  async createToken(req: CorrelatedMessage<CreateTokenDTO | CreateMFATokenDTO>): Promise<DidCreateTokenDTO> {
    if ('challenge_id' in req.data && 'mfa_code' in req.data) {
      CreateMFATokenDTOSchema.parse(req.data);
      return await authService.createMFAToken(req.data);
    } else {
      CreateTokenDTOSchema.parse(req.data);
      return await authService.createToken(req.data);
    }
  }

  async refreshToken(req: CorrelatedMessage<RefreshTokenDTO>): Promise<DidRefreshTokenDTO> {
    RefreshTokenDTOSchema.parse(req.data);

    return await authService.refreshToken(req.data);
  }

  async revokeToken(req: CorrelatedMessage<RevokeTokenDTO>): Promise<void> {
    RevokeTokenDTOSchema.parse(req.data);

    await authService.revokeToken(req.data);
  }
}

export default new AuthController();
