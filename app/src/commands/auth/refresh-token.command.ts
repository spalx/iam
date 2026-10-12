import { RefreshTokenDTO, DidRefreshTokenDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class RefreshTokenCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<RefreshTokenDTO>): Promise<DidRefreshTokenDTO> {
    return await authController.refreshToken(req);
  }
}
