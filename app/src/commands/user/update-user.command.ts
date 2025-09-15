import { UpdateUserDTO, UserEntityDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class UpdateUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<UpdateUserDTO>): Promise<UserEntityDTO> {
    return await userController.updateUser(req);
  }
}
