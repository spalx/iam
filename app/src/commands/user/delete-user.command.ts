import { DeleteUserDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class DeleteUserCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<DeleteUserDTO>): Promise<void> {
    await userController.deleteUser(requestData);
  }
}
