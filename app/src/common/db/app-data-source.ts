import {
  DataSource,
  DataSourceOptions,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  QueryRunner,
  Repository,
} from 'typeorm';
import { DataSourceExtensionOptions } from '@/interfaces/db-config.interface';
import config from '@/config/db.config';

class AppDataSource {
  private _instance: DataSource | null = null;
  private readonly config: DataSourceOptions;

  constructor() {
    this.config = config;
  }

  public async initialize(options: DataSourceExtensionOptions = {}): Promise<DataSource> {
    if (this._instance) return this._instance;

    const combinedEntities = [...(this.config.entities as string[]), ...(options?.extraEntities || [])];
    const combinedMigrations = [...(this.config.migrations as string[]), ...(options?.extraMigrations || [])];

    const finalizedConfig: DataSourceOptions = {
      ...this.config,
      entities: combinedEntities,
      migrations: combinedMigrations,
    };

    this._instance = new DataSource(finalizedConfig);
    return await this._instance.initialize();
  }

  public async runMigrations() {
    await this._instance.runMigrations();
  }

  public async destroy() {
    await this._instance.destroy();
  }

  public async transaction<T>(runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T> {
    const dataSource = this.instance;
    return await dataSource.transaction(runInTransaction);
  }

  public get instance(): DataSource {
    if (!this._instance) {
      throw new Error('Database has not been initialized yet. Call initialize() first.');
    }
    return this._instance;
  }

  public get manager() {
    return this.instance.manager;
  }

  public getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): Repository<Entity> {
    return this.instance.getRepository(target);
  }

  public createQueryRunner(): QueryRunner {
    return this.instance.createQueryRunner();
  }

  public async query<T = unknown>(queryStr: string, parameters?: unknown[]): Promise<T> {
    const dataSource = this.instance;
    return await dataSource.query<T>(queryStr, parameters);
  }
}

const appDataSource = new AppDataSource();

export default appDataSource;
