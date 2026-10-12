import { GetUserDTO, UserEntityDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class GetUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetUserDTO>): Promise<UserEntityDTO> {
    return await userController.getUser(req);
  }
}
