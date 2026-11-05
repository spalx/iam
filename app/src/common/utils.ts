import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { BadRequestError, GetAllRestQueryParams, RestFilterFieldOperator } from '@spalx/rest-pkg';

export function sha256(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

function columnOf(columns: Record<string, string>, name: string): string | undefined {
  return Object.hasOwn(columns, name) ? columns[name] : undefined;
}

/**
 * Applies a list request to a query. Only the names in `columns` may be filtered or sorted by, and only those in
 * `selectable` selected: caller text never becomes SQL, and values always go in as parameters.
 */
export function applyRestQueryParams<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  params: Partial<GetAllRestQueryParams>,
  columns: Record<string, string>,
  selectable: string[] = []
): SelectQueryBuilder<T> {
  params.fields?.forEach((field) => {
    if (!selectable.includes(field)) {
      throw new BadRequestError(`Unknown field ${field}`);
    }
  });
  params.filters?.forEach(({ name }) => {
    if (!columnOf(columns, name)) {
      throw new BadRequestError(`Unknown filter field ${name}`);
    }
  });
  params.sort?.forEach(({ sort_by }) => {
    if (!columnOf(columns, sort_by)) {
      throw new BadRequestError(`Unknown sort field ${sort_by}`);
    }
  });

  // Fields
  if (params.fields && params.fields.length > 0) {
    const selects = params.fields.map((f) => `${alias}.${f}`);
    qb.select(selects);
  }

  // Filters
  if (params.filters && params.filters.length > 0) {
    params.filters.forEach((filter, i) => {
      const column = columnOf(columns, filter.name) as string;
      const paramName = `filter_${i}`;
      const values = filter.values;

      switch (filter.operator) {
        case RestFilterFieldOperator.Contains:
          qb.andWhere(`${column} ILIKE :${paramName}`, { [paramName]: `%${values[0]}%` });
          break;

        case RestFilterFieldOperator.NotContains:
          qb.andWhere(`${column} NOT ILIKE :${paramName}`, { [paramName]: `%${values[0]}%` });
          break;

        case RestFilterFieldOperator.StartsWith:
          qb.andWhere(`${column} ILIKE :${paramName}`, { [paramName]: `${values[0]}%` });
          break;

        case RestFilterFieldOperator.EndsWith:
          qb.andWhere(`${column} ILIKE :${paramName}`, { [paramName]: `%${values[0]}` });
          break;

        case RestFilterFieldOperator.Equal:
          qb.andWhere(`${column} = :${paramName}`, { [paramName]: values[0] });
          break;

        case RestFilterFieldOperator.Unequal:
          qb.andWhere(`${column} != :${paramName}`, { [paramName]: values[0] });
          break;

        case RestFilterFieldOperator.In:
          qb.andWhere(`${column} IN (:...${paramName})`, { [paramName]: values });
          break;

        case RestFilterFieldOperator.NotIn:
          qb.andWhere(`${column} NOT IN (:...${paramName})`, { [paramName]: values });
          break;

        case RestFilterFieldOperator.Between:
          if (values.length === 2) {
            qb.andWhere(`${column} BETWEEN :${paramName}_start AND :${paramName}_end`, {
              [`${paramName}_start`]: values[0],
              [`${paramName}_end`]: values[1],
            });
          }
          break;

        case RestFilterFieldOperator.GreaterThan:
          qb.andWhere(`${column} > :${paramName}`, { [paramName]: values[0] });
          break;

        case RestFilterFieldOperator.LessThan:
          qb.andWhere(`${column} < :${paramName}`, { [paramName]: values[0] });
          break;

        case RestFilterFieldOperator.GreaterOrEqualThan:
          qb.andWhere(`${column} >= :${paramName}`, { [paramName]: values[0] });
          break;

        case RestFilterFieldOperator.LessOrEqualThan:
          qb.andWhere(`${column} <= :${paramName}`, { [paramName]: values[0] });
          break;

        default:
          // Unknown operator: ignore
          break;
      }
    });
  }

  // Sorting
  if (params.sort && params.sort.length > 0) {
    params.sort.forEach((sortField) => {
      qb.addOrderBy(columnOf(columns, sortField.sort_by) as string, sortField.sort_direction === -1 ? 'DESC' : 'ASC');
    });
  } else {
    qb.addOrderBy(`${alias}.id`, 'DESC');
  }

  // Pagination
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  qb.skip((page - 1) * limit).take(limit);

  return qb;
}

export function generateUuid(): string {
  return randomUUID();
}
