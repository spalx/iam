import { Repository } from 'typeorm';
import { BadRequestError, GetAllRestQueryParams, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

import { Datasource } from './datasource';

interface FakeBuilder {
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
}

function buildBuilder(): FakeBuilder {
  const fake = {} as FakeBuilder;
  fake.andWhere = jest.fn(() => fake);
  fake.orderBy = jest.fn(() => fake);
  fake.skip = jest.fn(() => fake);
  fake.take = jest.fn(() => fake);
  fake.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return fake;
}

class ThingsDatasource extends Datasource<object> {
  protected fieldMap: Record<string, string> = { id: 'thing.id', owner: 'owners.name' };
  protected handledFilterNames: string[] = ['search'];

  protected alias(): string {
    return 'thing';
  }

  protected override transformFilters(filters: RestFilterField[]): RestFilterField[] {
    return filters.filter((found) => found.name !== 'search');
  }
}

let builder: FakeBuilder;

function list(params: GetAllRestQueryParams): Promise<[object[], number]> {
  const repository = { createQueryBuilder: jest.fn(() => builder) } as unknown as Repository<object>;
  return new ThingsDatasource(repository, params).output();
}

function filter(name: string, operator: RestFilterFieldOperator, ...values: string[]): RestFilterField {
  return { name, operator, values };
}

beforeEach(() => {
  builder = buildBuilder();
});

describe('Datasource - accepted names', () => {
  it('should map a known filter to its column with a parameter named by position only', async () => {
    await list({ filters: [filter('owner', RestFilterFieldOperator.Equal, 'dana')] });

    expect(builder.andWhere).toHaveBeenCalledWith('owners.name = :filter_0', { filter_0: 'dana' });
  });

  it.each<[RestFilterFieldOperator, string[], string, Record<string, unknown>]>([
    [RestFilterFieldOperator.Equal, ['a'], 'owners.name = :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.Unequal, ['a'], 'owners.name != :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.Contains, ['a'], 'owners.name ILIKE :filter_0', { filter_0: '%a%' }],
    [RestFilterFieldOperator.NotContains, ['a'], 'owners.name NOT ILIKE :filter_0', { filter_0: '%a%' }],
    [RestFilterFieldOperator.StartsWith, ['a'], 'owners.name ILIKE :filter_0', { filter_0: 'a%' }],
    [RestFilterFieldOperator.EndsWith, ['a'], 'owners.name ILIKE :filter_0', { filter_0: '%a' }],
    [RestFilterFieldOperator.In, ['a', 'b'], 'owners.name IN (:...filter_0)', { filter_0: ['a', 'b'] }],
    [RestFilterFieldOperator.NotIn, ['a', 'b'], 'owners.name NOT IN (:...filter_0)', { filter_0: ['a', 'b'] }],
    [RestFilterFieldOperator.GreaterThan, ['a'], 'owners.name > :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.LessThan, ['a'], 'owners.name < :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.GreaterOrEqualThan, ['a'], 'owners.name >= :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.LessOrEqualThan, ['a'], 'owners.name <= :filter_0', { filter_0: 'a' }],
  ])('should apply %s through the column, with values as parameters', async (operator, values, sql, parameters) => {
    await list({ filters: [filter('owner', operator, ...values)] });

    expect(builder.andWhere).toHaveBeenCalledWith(sql, parameters);
  });

  it('should skip a filter with only empty values, and Between with one value', async () => {
    await list({
      filters: [filter('owner', RestFilterFieldOperator.Equal, ''), filter('id', RestFilterFieldOperator.Between, 'a')],
    });

    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('should page only when a limit is given, starting from page 1', async () => {
    await list({ page: 0, limit: 5 });
    expect(builder.skip).toHaveBeenCalledWith(0);
    expect(builder.take).toHaveBeenCalledWith(5);

    builder = buildBuilder();
    await list({ page: 2, limit: -1 });
    expect(builder.skip).not.toHaveBeenCalled();
  });

  it('should leave the order alone without a sort or a default one', async () => {
    await list({ sort: [] });

    expect(builder.orderBy).not.toHaveBeenCalled();
  });

  it('should name the two parameters of Between by position', async () => {
    await list({ filters: [filter('id', RestFilterFieldOperator.Between, 'a', 'b')] });

    expect(builder.andWhere).toHaveBeenCalledWith('thing.id BETWEEN :filter_0_start AND :filter_0_end', {
      filter_0_start: 'a',
      filter_0_end: 'b',
    });
  });

  it('should accept a name the subclass handles itself', async () => {
    await expect(list({ filters: [filter('search', RestFilterFieldOperator.Equal, 'x')] })).resolves.toEqual([[], 0]);
    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('should sort by a known name through its column', async () => {
    await list({ sort: [{ sort_by: 'owner', sort_direction: -1 }] });

    expect(builder.orderBy).toHaveBeenCalledWith('owners.name', 'DESC');
  });

  it('should pass a value that looks like SQL as a parameter', async () => {
    await list({ filters: [filter('id', RestFilterFieldOperator.Equal, "x' OR '1'='1")] });

    expect(builder.andWhere).toHaveBeenCalledWith('thing.id = :filter_0', { filter_0: "x' OR '1'='1" });
  });
});

describe('Datasource - unknown names', () => {
  it.each(['id = id OR 1=1 --', 'password', 'thing.id', 'constructor'])(
    'should refuse the filter name %p before any query runs',
    async (name) => {
      const result = list({ filters: [filter(name, RestFilterFieldOperator.Equal, '1')] });

      await expect(result).rejects.toThrow(new BadRequestError(`Unknown filter field ${name}`));
      expect(builder.andWhere).not.toHaveBeenCalled();
      expect(builder.getManyAndCount).not.toHaveBeenCalled();
    }
  );

  it('should refuse an unknown filter name even when its values are empty', async () => {
    await expect(list({ filters: [filter('password', RestFilterFieldOperator.Equal, '')] })).rejects.toThrow(
      'Unknown filter field password'
    );
  });

  it.each(['(SELECT password FROM users LIMIT 1)', 'search', 'toString'])(
    'should refuse the sort name %p before any query runs',
    async (name) => {
      const result = list({ sort: [{ sort_by: name, sort_direction: 1 }] });

      await expect(result).rejects.toThrow(new BadRequestError(`Unknown sort field ${name}`));
      expect(builder.orderBy).not.toHaveBeenCalled();
      expect(builder.getManyAndCount).not.toHaveBeenCalled();
    }
  );

  it('should refuse an unknown name in a later sort entry too', async () => {
    const result = list({
      sort: [
        { sort_by: 'id', sort_direction: 1 },
        { sort_by: 'id; DROP TABLE things', sort_direction: 1 },
      ],
    });

    await expect(result).rejects.toThrow('Unknown sort field id; DROP TABLE things');
  });
});
