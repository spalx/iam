import { GetJWKSDTO } from 'iam-pkg';
import { CorrelatedRequestDTO } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class GetJWKSCommand extends BaseCommand {
  async execute(requestData: CorrelatedRequestDTO<GetJWKSDTO>): Promise<void> {
    await authController.getJWKS(requestData);
  }
}
