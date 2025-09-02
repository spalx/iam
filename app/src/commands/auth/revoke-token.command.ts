import { RevokeTokenDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class RevokeTokenCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<RevokeTokenDTO>): Promise<void> {
    await authController.revokeToken(requestData);
  }
}
