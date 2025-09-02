import { GetAllRestQueryParams } from 'rest-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class GetUsersCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<GetAllRestQueryParams>): Promise<void> {
    await userController.getUsers(requestData);
  }
}
