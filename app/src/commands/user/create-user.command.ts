import { CreateUserDTO, UserEntityDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class CreateUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<CreateUserDTO>): Promise<UserEntityDTO> {
    return await userController.createUser(req);
  }
}
