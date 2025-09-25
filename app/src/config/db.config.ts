import { DataSource } from 'typeorm';

import appConfig from '@/config/app.config';

const { host, user, password, name } = appConfig.db;

const appDataSource = new DataSource({
  type: 'postgres',
  host,
  username: user,
  password,
  database: name,
  synchronize: false,
  logging: false,
  entities: [__dirname + '/../entities/**/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],

  extra: {
    max: 10,                       // max connections in pool per service instance
    min: 2,                        // keep a couple warm
    idleTimeoutMillis: 30000,      // release idle connections after 30s
    connectionTimeoutMillis: 5000, // fail fast if DB is unavailable
  },
});

export default appDataSource;
