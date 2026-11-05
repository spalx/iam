import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { BadRequestError, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

import { applyRestQueryParams, generateUuid, sha256 } from './utils';

interface FakeBuilder {
  select: jest.Mock;
  andWhere: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
}

const COLUMNS = { id: 'role.id', name: 'role.name' };
const SELECTABLE = ['name', 'permissions'];

let builder: FakeBuilder;

function buildBuilder(): FakeBuilder {
  const fake = {} as FakeBuilder;
  fake.select = jest.fn(() => fake);
  fake.andWhere = jest.fn(() => fake);
  fake.addOrderBy = jest.fn(() => fake);
  fake.skip = jest.fn(() => fake);
  fake.take = jest.fn(() => fake);
  return fake;
}

function apply(params: Parameters<typeof applyRestQueryParams>[2]): void {
  applyRestQueryParams(builder as unknown as SelectQueryBuilder<ObjectLiteral>, 'role', params, COLUMNS, SELECTABLE);
}

function filter(name: string, operator: RestFilterFieldOperator, ...values: string[]): RestFilterField {
  return { name, operator, values };
}

beforeEach(() => {
  builder = buildBuilder();
});

describe('applyRestQueryParams - filters', () => {
  it.each<[RestFilterFieldOperator, string[], string, Record<string, unknown>]>([
    [RestFilterFieldOperator.Contains, ['su'], 'role.name ILIKE :filter_0', { filter_0: '%su%' }],
    [RestFilterFieldOperator.NotContains, ['su'], 'role.name NOT ILIKE :filter_0', { filter_0: '%su%' }],
    [RestFilterFieldOperator.StartsWith, ['su'], 'role.name ILIKE :filter_0', { filter_0: 'su%' }],
    [RestFilterFieldOperator.EndsWith, ['su'], 'role.name ILIKE :filter_0', { filter_0: '%su' }],
    [RestFilterFieldOperator.Equal, ['su'], 'role.name = :filter_0', { filter_0: 'su' }],
    [RestFilterFieldOperator.Unequal, ['su'], 'role.name != :filter_0', { filter_0: 'su' }],
    [RestFilterFieldOperator.In, ['a', 'b'], 'role.name IN (:...filter_0)', { filter_0: ['a', 'b'] }],
    [RestFilterFieldOperator.NotIn, ['a', 'b'], 'role.name NOT IN (:...filter_0)', { filter_0: ['a', 'b'] }],
    [RestFilterFieldOperator.GreaterThan, ['a'], 'role.name > :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.LessThan, ['a'], 'role.name < :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.GreaterOrEqualThan, ['a'], 'role.name >= :filter_0', { filter_0: 'a' }],
    [RestFilterFieldOperator.LessOrEqualThan, ['a'], 'role.name <= :filter_0', { filter_0: 'a' }],
    [
      RestFilterFieldOperator.Between,
      ['a', 'b'],
      'role.name BETWEEN :filter_0_start AND :filter_0_end',
      { filter_0_start: 'a', filter_0_end: 'b' },
    ],
  ])('should apply %s through the column, with values as parameters', (operator, values, sql, parameters) => {
    apply({ filters: [filter('name', operator, ...values)] });

    expect(builder.andWhere).toHaveBeenCalledWith(sql, parameters);
  });

  it('should skip Between without two values, and an unknown operator', () => {
    apply({
      filters: [
        filter('name', RestFilterFieldOperator.Between, 'a'),
        filter('id', 'Near' as RestFilterFieldOperator, 'x'),
      ],
    });

    expect(builder.andWhere).not.toHaveBeenCalled();
  });

  it('should keep a value that looks like SQL as a parameter', () => {
    apply({ filters: [filter('name', RestFilterFieldOperator.Equal, "x' OR '1'='1")] });

    expect(builder.andWhere).toHaveBeenCalledWith('role.name = :filter_0', { filter_0: "x' OR '1'='1" });
  });

  it.each(['name; DROP TABLE roles', 'permissions', 'constructor'])('should refuse the filter name %p', (name) => {
    expect(() => apply({ filters: [filter(name, RestFilterFieldOperator.Equal, 'x')] })).toThrow(
      new BadRequestError(`Unknown filter field ${name}`)
    );
    expect(builder.andWhere).not.toHaveBeenCalled();
  });
});

describe('applyRestQueryParams - sorting', () => {
  it('should sort by each known name, and by id newest first without one', () => {
    apply({
      sort: [
        { sort_by: 'name', sort_direction: 1 },
        { sort_by: 'id', sort_direction: -1 },
      ],
    });
    expect(builder.addOrderBy).toHaveBeenNthCalledWith(1, 'role.name', 'ASC');
    expect(builder.addOrderBy).toHaveBeenNthCalledWith(2, 'role.id', 'DESC');

    builder = buildBuilder();
    apply({});
    expect(builder.addOrderBy).toHaveBeenCalledWith('role.id', 'DESC');
  });

  it.each(['name; DROP TABLE roles', '(SELECT 1)', 'toString'])('should refuse the sort name %p', (name) => {
    expect(() => apply({ sort: [{ sort_by: name, sort_direction: 1 }] })).toThrow(
      new BadRequestError(`Unknown sort field ${name}`)
    );
    expect(builder.addOrderBy).not.toHaveBeenCalled();
  });
});

describe('applyRestQueryParams - fields and pages', () => {
  it('should select the requested known fields', () => {
    apply({ fields: ['name', 'permissions'] });

    expect(builder.select).toHaveBeenCalledWith(['role.name', 'role.permissions']);
  });

  it('should refuse a field outside the selectable list', () => {
    expect(() => apply({ fields: ['(SELECT password FROM users LIMIT 1)'] })).toThrow(
      new BadRequestError('Unknown field (SELECT password FROM users LIMIT 1)')
    );
    expect(builder.select).not.toHaveBeenCalled();
  });

  it('should take the requested page, ten rows by default', () => {
    apply({ page: 3, limit: 5 });
    expect(builder.skip).toHaveBeenCalledWith(10);
    expect(builder.take).toHaveBeenCalledWith(5);

    builder = buildBuilder();
    apply({});
    expect(builder.skip).toHaveBeenCalledWith(0);
    expect(builder.take).toHaveBeenCalledWith(10);
  });
});

describe('sha256 and generateUuid', () => {
  it('should hash to hexadecimal and make distinct uuids', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(generateUuid()).toMatch(/^[0-9a-f-]{36}$/);
    expect(generateUuid()).not.toBe(generateUuid());
  });
});
