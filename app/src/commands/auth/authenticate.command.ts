import { AuthenticateDTO, DidAuthenticateDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class AuthenticateCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<AuthenticateDTO>): Promise<DidAuthenticateDTO> {
    return await authController.authenticate(req);
  }
}
