import { CreateUserDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class CreateUserCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<CreateUserDTO>): Promise<void> {
    await userController.createUser(requestData);
  }
}
