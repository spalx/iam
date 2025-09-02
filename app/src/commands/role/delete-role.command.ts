import { DeleteRoleDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class DeleteRoleCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<DeleteRoleDTO>): Promise<void> {
    await roleController.deleteRole(requestData);
  }
}
