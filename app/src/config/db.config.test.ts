import dbConfig from './db.config';

describe('dbConfig', () => {
  it('should connect to PostgreSQL with the database settings from the config', () => {
    expect(dbConfig).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      username: 'test',
      password: 'test',
      database: 'iam-test',
    });
  });

  it('should never change the schema on its own, and run each migration in its own transaction', () => {
    expect(dbConfig).toMatchObject({ synchronize: false, logging: false, migrationsTransactionMode: 'each' });
  });

  it('should load the entities and migrations from their folders', () => {
    expect(dbConfig.entities).toEqual([expect.stringMatching(/\/entities\/\*\*\/\*\*\/\*\.entity\.\{ts,js\}$/)]);
    expect(dbConfig.migrations).toEqual([expect.stringMatching(/\/migrations\/\*\.\{ts,js\}$/)]);
  });

  it('should refuse undefined and null in where conditions', () => {
    expect(dbConfig.invalidWhereValuesBehavior).toEqual({ undefined: 'throw', null: 'throw' });
  });

  it('should keep the connection pool settings', () => {
    expect(dbConfig.extra).toEqual({ max: 10, min: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  });
});
