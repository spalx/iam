import { CreateRoleDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class CreateRoleCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<CreateRoleDTO>): Promise<void> {
    await roleController.createRole(requestData);
  }
}
