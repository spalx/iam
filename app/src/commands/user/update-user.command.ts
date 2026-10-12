import { UpdateUserDTO, UserEntityDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class UpdateUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<UpdateUserDTO>): Promise<UserEntityDTO> {
    return await userController.updateUser(req);
  }
}
