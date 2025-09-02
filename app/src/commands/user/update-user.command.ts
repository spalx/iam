import { UpdateUserDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class UpdateUserCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<UpdateUserDTO>): Promise<void> {
    await userController.updateUser(requestData);
  }
}
