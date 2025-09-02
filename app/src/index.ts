import 'reflect-metadata';
import { logger } from 'common-loggers-pkg';
import { appService } from 'app-life-cycle-pkg';
import { transportService } from 'transport-pkg';

import app from './app';

async function startServer(): Promise<void> {
  try {
    logger.info('Starting IAM service');

    appService.use(app);
    appService.use(transportService);

    await appService.run();

    logger.info('IAM service running');
  } catch (error) {
    logger.error('Failed to start IAM service', error);
    process.exit(1);
  }
}

startServer();
