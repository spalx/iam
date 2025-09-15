import { DeleteUserDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class DeleteUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<DeleteUserDTO>): Promise<void> {
    await userController.deleteUser(req);
  }
}
