import { UpdateRoleDTO, RoleEntityDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class UpdateRoleCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<UpdateRoleDTO>): Promise<RoleEntityDTO> {
    return await roleController.updateRole(req);
  }
}
