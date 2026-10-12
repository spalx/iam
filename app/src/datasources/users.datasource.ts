import { Repository } from 'typeorm';
import { GetAllRestQueryParams, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

import { Datasource } from './datasource';
import UserEntity from '@/entities/user/user.entity';
import appDataSource from '@/common/db/app-data-source';

class UsersDatasource extends Datasource<UserEntity> {
  private encryptedFiltersToApply: RestFilterField[] = [];

  protected fieldMap: Record<string, string> = {
    id: 'user.id',
    is_active: 'user.is_active',
    mfa_enabled: 'user.mfa_enabled',
    role_name: 'roles.name',
    created_at: 'user.created_at',
    updated_at: 'user.updated_at',
  };

  constructor(readonly params: GetAllRestQueryParams) {
    const userRepository: Repository<UserEntity> = appDataSource.getRepository(UserEntity);
    super(userRepository, params);
  }

  protected alias(): string {
    return 'user';
  }

  protected override transformFilters(filters: RestFilterField[]): RestFilterField[] {
    this.encryptedFiltersToApply = [];
    const nonEncryptedFilters: RestFilterField[] = [];

    filters.forEach((filter) => {
      if (filter.name === 'name' && filter.values.length > 0 && filter.values[0]) {
        // Handle name search: try all possible splits
        const searchValue = filter.values[0].trim();
        const searchWords = searchValue.split(/\s+/).filter((w) => w.length > 0);

        if (searchWords.length === 1) {
          // Single word - search by first_name only (startsWith)
          this.encryptedFiltersToApply.push({
            name: 'first_name',
            operator: RestFilterFieldOperator.StartsWith,
            values: [searchWords[0]],
          });
        } else {
          for (let i = 1; i <= searchWords.length; i++) {
            const firstnamePart = searchWords.slice(0, i).join(' ');
            const lastnamePart = searchWords.slice(i).join(' ');

            if (lastnamePart) {
              // Has lastname part: firstname equals AND lastname starts with
              this.encryptedFiltersToApply.push({
                name: 'first_name',
                operator: RestFilterFieldOperator.Equal,
                values: [firstnamePart],
              });
              this.encryptedFiltersToApply.push({
                name: 'last_name',
                operator: RestFilterFieldOperator.StartsWith,
                values: [lastnamePart],
              });
            } else {
              // No lastname part: firstname starts with
              this.encryptedFiltersToApply.push({
                name: 'first_name',
                operator: RestFilterFieldOperator.StartsWith,
                values: [firstnamePart],
              });
            }
          }
        }
      } else if (['email', 'phone'].includes(filter.name)) {
        // Other meta fields need to be filtered in-memory after decryption
        this.encryptedFiltersToApply.push(filter);
      } else {
        // Non-encrypted fields can be handled by the base class
        nonEncryptedFilters.push(filter);
      }
    });

    return nonEncryptedFilters;
  }

  protected buildJoins(): void {
    this.builder.leftJoinAndSelect('user.roles', 'roles');
  }

  protected override defaultSortField(): string | null {
    return 'user.created_at';
  }

  private getMetaValue(user: UserEntity, field: string): string | null {
    if (!user.meta) {
      return null;
    }

    return user.meta[field] ? String(user.meta[field]) : null;
  }

  private applyEncryptedFilter(user: UserEntity, filter: RestFilterField): boolean {
    const { name, operator, values } = filter;

    if (!values.length || values.every((v) => v === null || v === undefined || v === '')) {
      return true;
    }

    const userValue = this.getMetaValue(user, name);

    if (userValue === null || userValue === undefined) {
      return false;
    }

    const userValueStr = String(userValue);
    const searchValue = values[0];

    switch (operator) {
      case RestFilterFieldOperator.Equal:
        return userValueStr.toLowerCase() === String(searchValue).toLowerCase();

      case RestFilterFieldOperator.Unequal:
        return userValueStr.toLowerCase() !== String(searchValue).toLowerCase();

      case RestFilterFieldOperator.Contains:
        return userValueStr.toLowerCase().includes(String(searchValue).toLowerCase());

      case RestFilterFieldOperator.NotContains:
        return !userValueStr.toLowerCase().includes(String(searchValue).toLowerCase());

      case RestFilterFieldOperator.StartsWith:
        return userValueStr.toLowerCase().startsWith(String(searchValue).toLowerCase());

      case RestFilterFieldOperator.EndsWith:
        return userValueStr.toLowerCase().endsWith(String(searchValue).toLowerCase());

      case RestFilterFieldOperator.In:
        return values.some((val) => String(val).toLowerCase() === userValueStr.toLowerCase());

      case RestFilterFieldOperator.NotIn:
        return !values.some((val) => String(val).toLowerCase() === userValueStr.toLowerCase());

      default:
        return true;
    }
  }

  async output(): Promise<[UserEntity[], number]> {
    // Always build joins, filters, and sorting
    this.buildJoins();
    this.buildFilters();
    this.buildSorting();

    // If NO encrypted filters, apply pagination and return
    if (this.encryptedFiltersToApply.length === 0) {
      this.buildPagination();
      return this.builder.getManyAndCount();
    }

    // Get all records (without pagination) to filter in-memory
    const allRecords = await this.builder.getMany();

    const filteredRecords = allRecords.filter((user) => {
      const nameFilters = this.encryptedFiltersToApply.filter((f) => ['first_name', 'last_name'].includes(f.name));
      const otherFilters = this.encryptedFiltersToApply.filter((f) => !['first_name', 'last_name'].includes(f.name));

      const otherFiltersMatch = otherFilters.every((filter) => this.applyEncryptedFilter(user, filter));

      if (!otherFiltersMatch) {
        return false;
      }

      if (nameFilters.length === 0) {
        return true;
      }

      // For name filters, check if ANY combination matches (OR logic for splits)
      // Name filters come in pairs (first_name + last_name) or single (first_name only)
      for (let i = 0; i < nameFilters.length; ) {
        const currentFilter = nameFilters[i];
        const nextFilter = nameFilters[i + 1];

        if (currentFilter.name === 'first_name' && nextFilter?.name === 'last_name') {
          const firstMatch = this.applyEncryptedFilter(user, currentFilter);
          const lastMatch = this.applyEncryptedFilter(user, nextFilter);
          if (firstMatch && lastMatch) {
            return true;
          }
          i += 2;
        } else {
          // Single first_name filter
          if (this.applyEncryptedFilter(user, currentFilter)) {
            return true;
          }
          i += 1;
        }
      }

      return false;
    });

    // If limit is not provided or is -1, skip pagination (return all filtered results)
    if (!this.params.limit || this.params.limit === -1) {
      return [filteredRecords, filteredRecords.length];
    }

    // Apply pagination to filtered results
    const skip = (this.params.page - 1) * this.params.limit;
    const paginatedRecords = filteredRecords.slice(skip, skip + this.params.limit);

    return [paginatedRecords, filteredRecords.length];
  }
}

export default UsersDatasource;
