import type { DataSource } from 'typeorm';

jest.mock('typeorm', () => ({
  ...jest.requireActual<object>('typeorm'),
  DataSource: jest.fn(),
}));

type AppDataSourceModule = typeof import('./app-data-source');

interface Loaded {
  appDataSource: AppDataSourceModule['default'];
  DataSourceMock: jest.Mock;
  fake: FakeDataSource;
}

interface FakeDataSource {
  initialize: jest.Mock;
  runMigrations: jest.Mock;
  destroy: jest.Mock;
  transaction: jest.Mock;
  getRepository: jest.Mock;
  createQueryRunner: jest.Mock;
  query: jest.Mock;
  manager: object;
}

function buildFake(): FakeDataSource {
  const fake: FakeDataSource = {
    initialize: jest.fn(),
    runMigrations: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn(),
    getRepository: jest.fn(),
    createQueryRunner: jest.fn(),
    query: jest.fn(),
    manager: { name: 'manager' },
  };
  fake.initialize.mockResolvedValue(fake);
  return fake;
}

// The wrapper is a module singleton, so each test loads a fresh one with its own fake DataSource.
async function load(): Promise<Loaded> {
  let loaded: Loaded | undefined;
  await jest.isolateModulesAsync(async () => {
    const typeorm = await import('typeorm');
    const DataSourceMock = jest.mocked(typeorm.DataSource) as unknown as jest.Mock;
    const fake = buildFake();
    DataSourceMock.mockImplementation(() => fake);
    const appDataSource = (await import('./app-data-source')).default;
    loaded = { appDataSource, DataSourceMock, fake };
  });
  if (!loaded) {
    throw new Error('app-data-source did not load');
  }
  return loaded;
}

describe('AppDataSource - initialize', () => {
  it('should build one data source from the config, connect it and return it', async () => {
    // Arrange
    const { appDataSource, DataSourceMock, fake } = await load();

    // Act
    const result = await appDataSource.initialize();

    // Assert
    expect(result).toBe(fake);
    expect(DataSourceMock).toHaveBeenCalledTimes(1);
    const options = DataSourceMock.mock.calls[0][0];
    expect(options).toMatchObject({ type: 'postgres', database: 'iam-test', synchronize: false });
    expect(options.entities).toEqual([expect.stringMatching(/entities\/\*\*\/\*\*\/\*\.entity\.\{ts,js\}$/)]);
    expect(options.migrations).toEqual([expect.stringMatching(/migrations\/\*\.\{ts,js\}$/)]);
    expect(fake.initialize).toHaveBeenCalledTimes(1);
  });

  it('should add extra entities and migrations after the configured ones', async () => {
    const { appDataSource, DataSourceMock } = await load();

    await appDataSource.initialize({ extraEntities: ['extra/*.entity.ts'], extraMigrations: ['extra/*.ts'] });

    const options = DataSourceMock.mock.calls[0][0];
    expect(options.entities).toHaveLength(2);
    expect(options.entities[1]).toBe('extra/*.entity.ts');
    expect(options.migrations).toHaveLength(2);
    expect(options.migrations[1]).toBe('extra/*.ts');
  });

  it('should reuse the data source on a second call', async () => {
    const { appDataSource, DataSourceMock, fake } = await load();
    await appDataSource.initialize();

    const second = await appDataSource.initialize();

    expect(second).toBe(fake);
    expect(DataSourceMock).toHaveBeenCalledTimes(1);
    expect(fake.initialize).toHaveBeenCalledTimes(1);
  });

  it('should pass a connection error through', async () => {
    const { appDataSource, fake } = await load();
    const error = new Error('connect ECONNREFUSED');
    fake.initialize.mockRejectedValueOnce(error);

    await expect(appDataSource.initialize()).rejects.toBe(error);
  });
});

describe('AppDataSource - before initialize', () => {
  const NOT_INITIALIZED = 'Database has not been initialized yet. Call initialize() first.';

  it.each<[string, (ds: AppDataSourceModule['default']) => unknown]>([
    ['instance', (ds) => ds.instance],
    ['manager', (ds) => ds.manager],
    ['getRepository', (ds) => ds.getRepository('users')],
    ['createQueryRunner', (ds) => ds.createQueryRunner()],
  ])('should throw from %s', async (_name, use) => {
    const { appDataSource } = await load();

    expect(() => use(appDataSource)).toThrow(NOT_INITIALIZED);
  });

  it.each<[string, (ds: AppDataSourceModule['default']) => Promise<unknown>]>([
    ['transaction', (ds) => ds.transaction(async (): Promise<void> => undefined)],
    ['query', (ds) => ds.query('SELECT 1')],
  ])('should reject from %s', async (_name, use) => {
    const { appDataSource } = await load();

    await expect(use(appDataSource)).rejects.toThrow(NOT_INITIALIZED);
  });

  // These two reach the data source directly rather than through the instance getter.
  it.each<[string, (ds: AppDataSourceModule['default']) => Promise<unknown>]>([
    ['runMigrations', (ds) => ds.runMigrations()],
    ['destroy', (ds) => ds.destroy()],
  ])('should fail from %s with a TypeError', async (_name, use) => {
    const { appDataSource } = await load();

    await expect(use(appDataSource)).rejects.toBeInstanceOf(TypeError);
  });
});

describe('AppDataSource - after initialize', () => {
  it('should pass every call through to the data source', async () => {
    // Arrange
    const { appDataSource, fake } = await load();
    await appDataSource.initialize();
    const repository = { name: 'repository' };
    const runner = { name: 'runner' };
    const work = async (): Promise<string> => 'done';
    fake.getRepository.mockReturnValue(repository);
    fake.createQueryRunner.mockReturnValue(runner);
    fake.transaction.mockResolvedValue('done');
    fake.query.mockResolvedValue([{ count: '1' }]);

    // Act and Assert
    expect(appDataSource.instance).toBe(fake as unknown as DataSource);
    expect(appDataSource.manager).toBe(fake.manager);
    expect(appDataSource.getRepository('users')).toBe(repository);
    expect(fake.getRepository).toHaveBeenCalledWith('users');
    expect(appDataSource.createQueryRunner()).toBe(runner);
    await expect(appDataSource.transaction(work)).resolves.toBe('done');
    expect(fake.transaction).toHaveBeenCalledWith(work);
    await expect(appDataSource.query('SELECT $1', [1])).resolves.toEqual([{ count: '1' }]);
    expect(fake.query).toHaveBeenCalledWith('SELECT $1', [1]);
    await appDataSource.runMigrations();
    expect(fake.runMigrations).toHaveBeenCalledTimes(1);
    await appDataSource.destroy();
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });
});
