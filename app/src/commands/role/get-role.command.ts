import { GetRoleDTO, RoleEntityDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class GetRoleCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetRoleDTO>): Promise<RoleEntityDTO> {
    return await roleController.getRole(req);
  }
}
