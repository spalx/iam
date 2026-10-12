import { SelectQueryBuilder, Repository } from 'typeorm';
import { GetAllRestQueryParams, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

export abstract class Datasource<Entity, Output = Entity> {
  protected builder: SelectQueryBuilder<Entity>;

  constructor(
    protected repo: Repository<Entity>,
    protected params: GetAllRestQueryParams
  ) {
    this.builder = repo.createQueryBuilder(this.alias());
  }

  protected abstract alias(): string;

  protected fieldMap: Record<string, string> = {};
  protected get globalFields(): string[] {
    return [];
  }

  protected buildJoins(): void {
    // Optional: Override this method in subclasses if custom JOINs are needed.
  }

  protected defaultSortField(): string | null {
    return null; //Optional: Override in child class to define default sorting field (e.g., 'created_at').
  }

  protected buildSorting(): void {
    const sort = this.params.sort;
    if (!sort || !sort.length) {
      const fallbackField = this.defaultSortField();
      if (fallbackField) {
        this.builder.orderBy(fallbackField, 'DESC');
      }
      return;
    }

    const sortField = sort[0].sort_by;
    const sortDirection = sort[0].sort_direction;
    const sortOrder = sortDirection == 1 ? 'ASC' : 'DESC';
    const dbField = this.fieldMap[sortField] ?? `${this.alias()}.${sortField}`;

    if (sortField) {
      this.builder.orderBy(dbField, sortOrder);
    }
  }

  protected buildPagination(): void {
    // If limit is not provided or -1, skip pagination (get all results)
    if (!this.params.limit || this.params.limit === -1) {
      return;
    }

    if (this.params.page < 1) {
      this.params.page = 1;
    }

    const skip = (this.params.page - 1) * this.params.limit;
    const take = this.params.limit;

    this.builder.skip(skip).take(take);
  }

  protected transformFilters(filters: RestFilterField[]): RestFilterField[] {
    return filters;
  }

  protected buildFilters(): void {
    if (!this.params.filters || !this.params.filters.length) {
      return;
    }

    const filters = this.transformFilters([...this.params.filters]);

    filters.forEach((filter, index) => {
      const { name, operator, values } = filter;

      if (!values.length || values.every((v) => v === null || v === undefined || v === '')) {
        return;
      }

      const dbField = this.fieldMap[name] ?? `${this.alias()}.${name}`;
      const paramName = `filter_${name}_${index}`;

      switch (operator) {
        case RestFilterFieldOperator.Equal:
          this.builder.andWhere(`${dbField} = :${paramName}`, {
            [paramName]: values[0],
          });
          break;

        case RestFilterFieldOperator.Unequal:
          this.builder.andWhere(`${dbField} != :${paramName}`, {
            [paramName]: values[0],
          });
          break;

        case RestFilterFieldOperator.Contains:
          this.builder.andWhere(`${dbField} ILIKE :${paramName}`, {
            [paramName]: `%${values[0]}%`,
          });
          break;

        case RestFilterFieldOperator.NotContains:
          this.builder.andWhere(`${dbField} NOT ILIKE :${paramName}`, {
            [paramName]: `%${values[0]}%`,
          });
          break;

        case RestFilterFieldOperator.StartsWith:
          this.builder.andWhere(`${dbField} ILIKE :${paramName}`, {
            [paramName]: `${values[0]}%`,
          });
          break;

        case RestFilterFieldOperator.EndsWith:
          this.builder.andWhere(`${dbField} ILIKE :${paramName}`, {
            [paramName]: `%${values[0]}`,
          });
          break;

        case RestFilterFieldOperator.In:
          this.builder.andWhere(`${dbField} IN (:...${paramName})`, {
            [paramName]: values,
          });
          break;

        case RestFilterFieldOperator.NotIn:
          this.builder.andWhere(`${dbField} NOT IN (:...${paramName})`, {
            [paramName]: values,
          });
          break;

        case RestFilterFieldOperator.GreaterThan:
          this.builder.andWhere(`${dbField} > :${paramName}`, {
            [paramName]: values[0],
          });
          break;

        case RestFilterFieldOperator.LessThan:
          this.builder.andWhere(`${dbField} < :${paramName}`, {
            [paramName]: values[0],
          });
          break;

        case RestFilterFieldOperator.GreaterOrEqualThan:
          this.builder.andWhere(`${dbField} >= :${paramName}`, {
            [paramName]: values[0],
          });
          break;

        case RestFilterFieldOperator.LessOrEqualThan:
          this.builder.andWhere(`${dbField} <= :${paramName}`, {
            [paramName]: values[0],
          });
          break;

        case RestFilterFieldOperator.Between:
          if (values.length >= 2) {
            this.builder.andWhere(`${dbField} BETWEEN :${paramName}Start AND :${paramName}End`, {
              [`${paramName}Start`]: values[0],
              [`${paramName}End`]: values[1],
            });
          }
          break;
      }
    });
  }

  protected buildQuery(): void {
    this.buildJoins();
    this.buildFilters();
    this.buildSorting();
    this.buildPagination();
  }

  async getData(): Promise<[Output[], number]> {
    this.buildQuery();
    return this.builder.getManyAndCount() as unknown as Promise<[Output[], number]>;
  }

  async output(): Promise<[Output[], number]> {
    return this.getData();
  }
}
