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
const ANNA = user('anna', { first_name: 'Anna Maria', last_name: 'Cohen Levi', email: 'anna@example.com' });
const DAN = user('dan', { first_name: 'Dan', last_name: 'Avraham', phone: '0527654321' });
const NO_META = user('no-meta', null);
const EVERYONE = [DANA, ANNA, DAN, NO_META];

function filter(name: string, operator: RestFilterFieldOperator, ...values: string[]): RestFilterField {
  return { name, operator, values };
}

async function list(params: GetAllRestQueryParams): Promise<[UserEntity[], number]> {
  return new UsersDatasource(params).output();
}

async function ids(params: GetAllRestQueryParams): Promise<string[]> {
  const [users] = await list(params);
  return users.map((found) => found.id);
}

beforeEach(() => {
  builder = buildBuilder();
  builder.getMany.mockResolvedValue(EVERYONE);
  repository.createQueryBuilder.mockReturnValue(builder);
  jest.mocked(appDataSource.getRepository).mockReturnValue(repository as never);
});

describe('UsersDatasource - without an encrypted filter', () => {
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
  it.each(['password', 'identities', 'first_name', 'meta'])(
    'should refuse the filter %p without reading any user',
    async (name) => {
      await expect(list({ filters: [filter(name, RestFilterFieldOperator.Equal, 'x')] })).rejects.toThrow(
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

describe('UsersDatasource - email and phone', () => {
  it.each<[RestFilterFieldOperator, string[], string[]]>([
    [RestFilterFieldOperator.Equal, ['dana@example.COM'], ['dana']],
    [RestFilterFieldOperator.Unequal, ['dana@example.com'], ['anna']],
    [RestFilterFieldOperator.Contains, ['EXAMPLE'], ['dana', 'anna']],
    [RestFilterFieldOperator.NotContains, ['dana'], ['anna']],
    [RestFilterFieldOperator.StartsWith, ['AN'], ['anna']],
    [RestFilterFieldOperator.EndsWith, ['.com'], ['dana', 'anna']],
    [RestFilterFieldOperator.In, ['nobody@example.com', 'ANNA@example.com'], ['anna']],
    [RestFilterFieldOperator.NotIn, ['anna@example.com'], ['dana']],
    [RestFilterFieldOperator.GreaterThan, ['a'], ['dana', 'anna']],
  ])('should match email %s %p in the decrypted details, ignoring case', async (operator, values, expected) => {
    expect(await ids({ filters: [filter('email', operator, ...values)] })).toEqual(expected);
  });

  it('should leave users without the field out, and search all rows without paginating in SQL', async () => {
    // Act
    const found = await ids({ filters: [filter('phone', RestFilterFieldOperator.StartsWith, '05')] });

    // Assert
    expect(found).toEqual(['dana', 'dan']);
    expect(builder.getMany).toHaveBeenCalledTimes(1);
    expect(builder.skip).not.toHaveBeenCalled();
    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('should ignore a filter with only empty values', async () => {
    expect(await ids({ filters: [filter('email', RestFilterFieldOperator.Equal, '')] })).toEqual(
      EVERYONE.map((found) => found.id)
    );
  });

  it('should combine an encrypted filter with a plain one in SQL', async () => {
    await ids({
      filters: [
        filter('email', RestFilterFieldOperator.Contains, 'example'),
        filter('is_active', RestFilterFieldOperator.Equal, 'true'),
      ],
    });

    expect(builder.andWhere).toHaveBeenCalledWith('user.is_active = :filter_0', { filter_0: 'true' });
  });
});

describe('UsersDatasource - name', () => {
  it('should match the start of the first name for one word, ignoring case', async () => {
    expect(await ids({ filters: [filter('name', RestFilterFieldOperator.Contains, '  dan ')] })).toEqual([
      'dana',
      'dan',
    ]);
  });

  it('should match a first name and the start of a last name for two words', async () => {
    expect(await ids({ filters: [filter('name', RestFilterFieldOperator.Contains, 'dana le')] })).toEqual(['dana']);
  });

  it('should try every split of several words', async () => {
    // "Anna Maria" + "Cohen ..." is the second split of four words.
    expect(await ids({ filters: [filter('name', RestFilterFieldOperator.Contains, 'anna maria cohen l')] })).toEqual([
      'anna',
    ]);
  });

  it('should match a first name of several words on its own', async () => {
    expect(await ids({ filters: [filter('name', RestFilterFieldOperator.Contains, 'anna mar')] })).toEqual(['anna']);
  });

  it('should match nobody when no split fits', async () => {
    expect(await ids({ filters: [filter('name', RestFilterFieldOperator.Contains, 'dana cohen')] })).toEqual([]);
  });

  it('should match a name and an email together', async () => {
    expect(
      await ids({
        filters: [
          filter('name', RestFilterFieldOperator.Contains, 'dan'),
          filter('phone', RestFilterFieldOperator.EndsWith, '4321'),
        ],
      })
    ).toEqual(['dan']);
  });

  it('should be ignored when its value is empty', async () => {
    await ids({ filters: [filter('name', RestFilterFieldOperator.Contains, '')] });

    expect(builder.getManyAndCount).toHaveBeenCalledTimes(1);
  });
});

describe('UsersDatasource - pagination after an encrypted filter', () => {
  const byEmail = [filter('email', RestFilterFieldOperator.Contains, 'example')];

  it('should return the requested page of the matches and count every match', async () => {
    expect(await list({ filters: byEmail, page: 2, limit: 1 })).toEqual([[ANNA], 2]);
  });

  it.each([undefined, -1])('should return every match for the limit %p', async (limit) => {
    expect(await list({ filters: byEmail, limit })).toEqual([[DANA, ANNA], 2]);
  });

  // Pinned as found: the page is computed from an undefined page number, which slices nothing.
  it('should return an empty page, with the full count, when a limit is given without a page', async () => {
    expect(await list({ filters: byEmail, limit: 1 })).toEqual([[], 2]);
  });
});
