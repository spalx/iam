import { DataSource } from 'typeorm';

import appConfig from '@/config/app.config';

const { host, user, password, name } = appConfig.db;

const appDataSource = new DataSource({
  type: 'postgres',
  host,
  username: user,
  password,
  database: name,
  synchronize: true, //TODO
  logging: false,
  entities: [__dirname + '/../entities/**/**/*.entity.{ts,js}'],
});

export default appDataSource;
