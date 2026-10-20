import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { createTestKeys } from './test-keys';

// Production runs PostgreSQL 18.
const POSTGRES_IMAGE = 'postgres:18';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function startTestDatabase(): Promise<void> {
  let container: StartedPostgreSqlContainer;
  try {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  } catch (error) {
    throw new Error(`Could not start the integration test database (${POSTGRES_IMAGE}). Is Docker running?`, {
      cause: error,
    });
  }

  globalThis.__POSTGRES_CONTAINER__ = container;

  // Jest workers inherit these. test/setup/integration-db.config.ts reads them.
  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_USER = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();
  process.env.DB_NAME = container.getDatabase();

  // Only once the database is up: Jest skips the global teardown when the global setup throws.
  createTestKeys();
}
