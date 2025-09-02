import { GetRoleDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class GetRoleCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<GetRoleDTO>): Promise<void> {
    await roleController.getRole(requestData);
  }
}
