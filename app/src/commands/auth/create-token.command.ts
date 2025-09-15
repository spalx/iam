import { CreateTokenDTO, DidCreateTokenDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class CreateTokenCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<CreateTokenDTO>): Promise<DidCreateTokenDTO> {
    return await authController.createToken(req);
  }
}
