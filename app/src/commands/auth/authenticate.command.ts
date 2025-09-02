import { AuthenticateDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class AuthenticateCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<AuthenticateDTO>): Promise<void> {
    await authController.authenticate(requestData);
  }
}
