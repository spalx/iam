import { DataSourceOptions } from 'typeorm';
import appConfig from '@/config/app.config';

const { host, user, password, name } = appConfig.db;

const config: DataSourceOptions = {
  type: 'postgres',
  host,
  username: user,
  password,
  database: name,
  synchronize: false,
  logging: false,
  entities: [__dirname + '/../entities/**/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
  migrationsTransactionMode: 'each',
  invalidWhereValuesBehavior: { undefined: 'throw', null: 'throw' },
  extra: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
};

export default config;
