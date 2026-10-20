import appDataSource from '@/common/db/app-data-source';

beforeAll(async () => {
  await appDataSource.initialize();
  await appDataSource.runMigrations();
});

// Every test starts from empty tables, so no test sees rows another one wrote.
beforeEach(async () => {
  const tables = appDataSource.instance.entityMetadatas
    .filter((metadata) => metadata.tableType === 'regular' || metadata.tableType === 'junction')
    .map((metadata) => `"${metadata.tableName}"`);

  await appDataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await appDataSource.destroy();
});
