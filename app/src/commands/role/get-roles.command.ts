import { RoleEntityDTO } from 'iam-pkg';
import { GetAllRestQueryParams, GetAllRestPaginatedResponse } from 'rest-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class GetRolesCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetAllRestQueryParams>): Promise<GetAllRestPaginatedResponse<RoleEntityDTO>> {
    return await roleController.getRoles(req);
  }
}
