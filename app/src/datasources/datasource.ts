import { SelectQueryBuilder, Repository } from 'typeorm';
import { BadRequestError, GetAllRestQueryParams, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

export abstract class Datasource<Entity, Output = Entity> {
  protected builder: SelectQueryBuilder<Entity>;

  constructor(
    protected repo: Repository<Entity>,
    protected params: GetAllRestQueryParams
  ) {
    this.builder = repo.createQueryBuilder(this.alias());
  }

  protected abstract alias(): string;

  // The only names a caller may filter or sort by, each mapped to its column. Caller text never becomes SQL.
  protected fieldMap: Record<string, string> = {};
  // Filter names a subclass takes out in transformFilters and applies itself.
  protected handledFilterNames: string[] = [];
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

    sort.forEach(({ sort_by }) => {
      if (sort_by && !this.column(sort_by)) {
        throw new BadRequestError(`Unknown sort field ${sort_by}`);
      }
    });

    const sortField = sort[0].sort_by;
    const sortDirection = sort[0].sort_direction;
    const sortOrder = sortDirection == 1 ? 'ASC' : 'DESC';

    if (sortField) {
      this.builder.orderBy(this.column(sortField) as string, sortOrder);
    }
  }

  private column(name: string): string | undefined {
    return Object.hasOwn(this.fieldMap, name) ? this.fieldMap[name] : undefined;
  }

  private assertFilterNamesKnown(filters: RestFilterField[]): void {
    filters.forEach(({ name }) => {
      if (!this.column(name) && !this.handledFilterNames.includes(name)) {
        throw new BadRequestError(`Unknown filter field ${name}`);
      }
    });
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

    this.assertFilterNamesKnown(this.params.filters);
    const filters = this.transformFilters([...this.params.filters]);

    filters.forEach((filter, index) => {
      const { name, operator, values } = filter;

      if (!values.length || values.every((v) => v === null || v === undefined || v === '')) {
        return;
      }

      const dbField = this.column(name);
      if (!dbField) {
        throw new BadRequestError(`Unknown filter field ${name}`);
      }
      const paramName = `filter_${index}`;

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
            this.builder.andWhere(`${dbField} BETWEEN :${paramName}_start AND :${paramName}_end`, {
              [`${paramName}_start`]: values[0],
              [`${paramName}_end`]: values[1],
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
