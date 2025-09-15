import { GetJWKSDTO, DidGetJWKSDTO } from 'iam-pkg';
import { CorrelatedMessage } from 'transport-pkg';

import BaseCommand from '@/commands/base.command';
import authController from '@/controllers/auth.controller';

export default class GetJWKSCommand extends BaseCommand {
  async execute(req: CorrelatedMessage<GetJWKSDTO>): Promise<DidGetJWKSDTO> {
    return await authController.getJWKS(req);
  }
}
