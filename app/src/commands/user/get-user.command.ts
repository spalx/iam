import { GetUserDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class GetUserCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<GetUserDTO>): Promise<void> {
    await userController.getUser(requestData);
  }
}
