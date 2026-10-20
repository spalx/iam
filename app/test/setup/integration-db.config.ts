import { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';

import config from '../../src/config/db.config';

if (config.type !== 'postgres') {
  throw new Error(`Integration tests expect a postgres db.config, got "${config.type}"`);
}

// Replaces @/config/db.config in integration tests: the real entities and migrations, pointed at the
// database the global setup started.
const integrationDbConfig: PostgresDataSourceOptions = {
  ...config,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

export default integrationDbConfig;
