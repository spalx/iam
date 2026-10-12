import { DeleteUserDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class DeleteUserCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<DeleteUserDTO>): Promise<void> {
    await userController.deleteUser(req);
  }
}
