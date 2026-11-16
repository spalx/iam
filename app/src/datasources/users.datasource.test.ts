import { GetAllRestQueryParams, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import UserEntity from '@/entities/user/user.entity';
import UsersDatasource from './users.datasource';

jest.mock('@/common/db/app-data-source', () => ({
  __esModule: true,
  default: { getRepository: jest.fn() },
}));

interface FakeBuilder {
  leftJoinAndSelect: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
  getManyAndCount: jest.Mock;
}

let builder: FakeBuilder;
const repository = { createQueryBuilder: jest.fn() };

function buildBuilder(): FakeBuilder {
  const fake = {} as FakeBuilder;
  fake.leftJoinAndSelect = jest.fn(() => fake);
  fake.andWhere = jest.fn(() => fake);
  fake.orderBy = jest.fn(() => fake);
  fake.skip = jest.fn(() => fake);
  fake.take = jest.fn(() => fake);
  fake.getMany = jest.fn().mockResolvedValue([]);
  fake.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return fake;
}

function user(id: string, meta: Record<string, unknown> | null): UserEntity {
  return Object.assign(new UserEntity(), { id, meta });
}

const DANA = user('dana', { first_name: 'Dana', last_name: 'Levi', email: 'Dana@Example.com', phone: '0501234567' });

function filter(name: string, operator: RestFilterFieldOperator, ...values: string[]): RestFilterField {
  return { name, operator, values };
}

async function list(params: GetAllRestQueryParams): Promise<[UserEntity[], number]> {
  return new UsersDatasource(params).output();
}

beforeEach(() => {
  builder = buildBuilder();
  repository.createQueryBuilder.mockReturnValue(builder);
  jest.mocked(appDataSource.getRepository).mockReturnValue(repository as never);
});

describe('UsersDatasource - listing', () => {
  it('should query with the roles joined, newest first, one page at a time', async () => {
    // Arrange
    builder.getManyAndCount.mockResolvedValueOnce([[DANA], 9]);

    // Act
    const result = await list({ page: 3, limit: 2 });

    // Assert
    expect(result).toEqual([[DANA], 9]);
    expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
    expect(builder.leftJoinAndSelect).toHaveBeenCalledWith('user.roles', 'roles');
    expect(builder.orderBy).toHaveBeenCalledWith('user.created_at', 'DESC');
    expect(builder.skip).toHaveBeenCalledWith(4);
    expect(builder.take).toHaveBeenCalledWith(2);
    expect(builder.getMany).not.toHaveBeenCalled();
  });

  it('should map a role_name filter and a requested sort to their columns', async () => {
    await list({
      filters: [filter('role_name', RestFilterFieldOperator.Equal, 'admin')],
      sort: [{ sort_by: 'updated_at', sort_direction: 1 }],
    });

    expect(builder.andWhere).toHaveBeenCalledWith('roles.name = :filter_0', { filter_0: 'admin' });
    expect(builder.orderBy).toHaveBeenCalledWith('user.updated_at', 'ASC');
  });

  it('should not paginate without a limit', async () => {
    await list({ page: 2 });

    expect(builder.skip).not.toHaveBeenCalled();
    expect(builder.take).not.toHaveBeenCalled();
  });

  // Pinned as found: the page is computed from an undefined page number.
  it('should skip NaN rows when a limit is given without a page', async () => {
    await list({ limit: 5 });

    expect(builder.skip).toHaveBeenCalledWith(NaN);
  });
});

describe('UsersDatasource - unknown names', () => {
  it.each(['password', 'identities', 'first_name', 'meta', 'name', 'email', 'phone'])(
    'should refuse the filter %p without reading any user',
    async (name) => {
      await expect(list({ filters: [filter(name, RestFilterFieldOperator.StartsWith, 'x')] })).rejects.toThrow(
        `Unknown filter field ${name}`
      );
      expect(builder.getMany).not.toHaveBeenCalled();
      expect(builder.getManyAndCount).not.toHaveBeenCalled();
    }
  );

  it.each(['email', 'name', 'password'])('should refuse to sort by %p', async (name) => {
    await expect(list({ sort: [{ sort_by: name, sort_direction: 1 }] })).rejects.toThrow(`Unknown sort field ${name}`);
  });
});

describe('UsersDatasource - one page reads one page', () => {
  it('should page and count in SQL with a role filter, never reading every user', async () => {
    // Arrange
    builder.getManyAndCount.mockResolvedValueOnce([[DANA], 500]);

    // Act
    const result = await list({
      filters: [filter('role_name', RestFilterFieldOperator.NotIn, 'customer')],
      page: 1,
      limit: 10,
    });

    // Assert
    expect(result).toEqual([[DANA], 500]);
    expect(builder.skip).toHaveBeenCalledWith(0);
    expect(builder.take).toHaveBeenCalledWith(10);
    expect(builder.getMany).not.toHaveBeenCalled();
  });
});
