import { DeleteRoleDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class DeleteRoleCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<DeleteRoleDTO>): Promise<void> {
    await roleController.deleteRole(req);
  }
}
