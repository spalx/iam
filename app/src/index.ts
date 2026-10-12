import 'reflect-metadata';
import { logger } from '@spalx/common-loggers-pkg';
import { appService } from '@spalx/app-life-cycle-pkg';

import app from './app';
import { redactSensitiveLogFields } from './common/log-redaction';

redactSensitiveLogFields();

async function startServer(): Promise<void> {
  try {
    logger.info('Starting IAM service');

    await appService.run(app);

    logger.info('IAM service running');
  } catch (error) {
    logger.error('Failed to start IAM service', error);
    process.exit(1);
  }
}

startServer();
