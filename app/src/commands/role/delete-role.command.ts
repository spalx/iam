import { DeleteRoleDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class DeleteRoleCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<DeleteRoleDTO>): Promise<void> {
    await roleController.deleteRole(req);
  }
}
