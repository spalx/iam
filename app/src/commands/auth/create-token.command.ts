import { CreateTokenDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class CreateTokenCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<CreateTokenDTO>): Promise<void> {
    await authController.createToken(requestData);
  }
}
