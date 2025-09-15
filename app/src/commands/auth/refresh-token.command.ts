import { RefreshTokenDTO, DidRefreshTokenDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class RefreshTokenCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<RefreshTokenDTO>): Promise<DidRefreshTokenDTO> {
    return await authController.refreshToken(req);
  }
}
