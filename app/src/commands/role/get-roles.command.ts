import { GetAllRestQueryParams } from 'rest-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import roleController from '@/controllers/role.controller';

export default class GetRolesCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<GetAllRestQueryParams>): Promise<void> {
    await roleController.getRoles(requestData);
  }
}
