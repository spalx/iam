import { UserEntityDTO } from '@spalx/iam-pkg';
import { GetAllRestQueryParams, GetAllRestPaginatedResponse } from '@spalx/rest-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import userController from '@/controllers/user.controller';

export default class GetUsersCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetAllRestQueryParams>): Promise<GetAllRestPaginatedResponse<UserEntityDTO>> {
    return await userController.getUsers(req);
  }
}
