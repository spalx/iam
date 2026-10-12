import { DeleteRolesDTO } from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class DeleteRolesCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<DeleteRolesDTO>): Promise<void> {
    await roleController.deleteRoles(req);
  }
}
