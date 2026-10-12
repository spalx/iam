import { RoleEntityDTO } from '@spalx/iam-pkg';
import { GetAllRestQueryParams, GetAllRestPaginatedResponse } from '@spalx/rest-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class GetRolesCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetAllRestQueryParams>): Promise<GetAllRestPaginatedResponse<RoleEntityDTO>> {
    return await roleController.getRoles(req);
  }
}
