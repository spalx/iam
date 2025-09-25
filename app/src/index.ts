import 'reflect-metadata';
import { logger } from 'common-loggers-pkg';
import { appService } from 'app-life-cycle-pkg';

import app from './app';

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
