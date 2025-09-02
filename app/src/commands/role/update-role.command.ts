import { UpdateRoleDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class UpdateRoleCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<UpdateRoleDTO>): Promise<void> {
    await roleController.updateRole(requestData);
  }
}
