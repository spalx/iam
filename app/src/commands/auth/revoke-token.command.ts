import { RevokeTokenDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class RevokeTokenCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<RevokeTokenDTO>): Promise<void> {
    await authController.revokeToken(req);
  }
}
