import { RevokeTokenDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class RevokeTokenCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<RevokeTokenDTO>): Promise<void> {
    await authController.revokeToken(req);
  }
}
