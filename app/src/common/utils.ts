import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { createHash } from 'crypto';
import { GetAllRestQueryParams, RestFilterFieldOperator } from 'rest-pkg';

export function sha256(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

export function applyRestQueryParams<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  params: GetAllRestQueryParams
): SelectQueryBuilder<T> {
  // Fields
  if (params.fields && params.fields.length > 0) {
    const selects = params.fields.map((f) => `${alias}.${f}`);
    qb.select(selects);
  }

  // Filters
  if (params.filters && params.filters.length > 0) {
    params.filters.forEach((filter, i) => {
      const column = `${alias}.${filter.name}`;
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
      qb.addOrderBy(
        `${alias}.${sortField.sort_by}`,
        sortField.sort_direction === -1 ? 'DESC' : 'ASC'
      );
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
