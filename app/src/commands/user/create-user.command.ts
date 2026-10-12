import { CreateUserDTO, UserEntityDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class CreateUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<CreateUserDTO>): Promise<UserEntityDTO> {
    return await userController.createUser(req);
  }
}
