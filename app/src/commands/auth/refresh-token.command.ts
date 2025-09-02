import { RefreshTokenDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class RefreshTokenCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<RefreshTokenDTO>): Promise<void> {
    await authController.refreshToken(requestData);
  }
}
