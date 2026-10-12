import { CreateRoleDTO, RoleEntityDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class CreateRoleCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<CreateRoleDTO>): Promise<RoleEntityDTO> {
    return await roleController.createRole(req);
  }
}
