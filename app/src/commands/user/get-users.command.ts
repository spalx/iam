import { UserEntityDTO } from 'iam-pkg';
import { GetAllRestQueryParams, GetAllRestPaginatedResponse } from 'rest-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class GetUsersCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetAllRestQueryParams>): Promise<GetAllRestPaginatedResponse<UserEntityDTO>> {
    return await userController.getUsers(req);
  }
}
