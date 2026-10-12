import { CreateTokenDTO, DidCreateTokenDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class CreateTokenCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<CreateTokenDTO>): Promise<DidCreateTokenDTO> {
    return await authController.createToken(req);
  }
}
