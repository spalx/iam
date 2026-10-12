import { Repository, In } from 'typeorm';
import { NotFoundError, BadRequestError, GetAllRestQueryParams } from '@spalx/rest-pkg';
import { CreateRoleDTO, UpdateRoleDTO, GetRoleDTO, DeleteRoleDTO, DeleteRolesDTO } from '@spalx/iam-pkg';

import RoleEntity from '@/entities/user/role.entity';
import appDataSource from '@/common/db/app-data-source';
import { applyRestQueryParams } from '@/common/utils';
import UserService from '@/services/user.service';

class RoleService {
  private get roleRepository(): Repository<RoleEntity> {
    return appDataSource.getRepository(RoleEntity);
  }

  async findRoleByName(name: string): Promise<RoleEntity> {
    const role: RoleEntity | null = await this.roleRepository.findOne({ where: { name } });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    return role;
  }

  async findRoleById(id: string): Promise<RoleEntity> {
    const role: RoleEntity | null = await this.roleRepository.findOneBy({ id });

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    return role;
  }

  async findRolesById(ids: string[]): Promise<RoleEntity[]> {
    const roles: RoleEntity[] = await this.roleRepository.findBy({
      id: In(ids),
    });

    if (roles.length !== ids.length) {
      throw new NotFoundError('One or more roles not found');
    }

    return roles;
  }

  async createRole(data: CreateRoleDTO): Promise<RoleEntity> {
    const nameInUse: string | false = await this.isNameUsed(data.name);
    if (nameInUse) {
      throw new BadRequestError(`Role with name ${nameInUse} already exists`);
    }

    const role = new RoleEntity();
    role.name = data.name;
    role.permissions = data.permissions;

    await role.save();

    return role;
  }

  async updateRole(data: UpdateRoleDTO): Promise<RoleEntity> {
    const role: RoleEntity = await this.findRoleById(data.id);

    if (data.name) {
      const nameInUse: string | false = await this.isNameUsed(data.name, role.id);
      if (nameInUse) {
        throw new BadRequestError(`Role with name ${nameInUse} already exists`);
      }

      role.name = data.name;
    }

    if (data.permissions) {
      role.permissions = data.permissions;
    }

    await role.save();

    return role;
  }

  async getRole(data: GetRoleDTO): Promise<RoleEntity> {
    if (data.name) {
      return await this.findRoleByName(data.name);
    } else if (data.id) {
      return await this.findRoleById(data.id);
    }

    throw new NotFoundError('Role not found'); // Should never reach here
  }

  async getRoles(data: GetAllRestQueryParams): Promise<{ roles: RoleEntity[]; count: number }> {
    const validFields = ['name', 'permissions'];

    // 1. Deduplicate and validate requested fields
    const requestedFields = Array.from(new Set(data.fields ?? [])).filter((f) => validFields.includes(f));

    // 2. Start query builder
    const qb = this.roleRepository.createQueryBuilder('role');

    // 3. Extract exclude filter from data.filters if present
    const excludeFilter = data.filters?.find((f) => f.name === 'exclude');

    if (excludeFilter && excludeFilter.values) {
      const excludeList = Array.isArray(excludeFilter.values)
        ? excludeFilter.values
        : String(excludeFilter.values)
            .split(',')
            .map((s) => s.trim());

      if (excludeList.length > 0) {
        qb.andWhere('role.name NOT IN (:...excludeRoles)', { excludeRoles: excludeList });
      }
    }

    // 4. Call generic helper (filter out the synthetic 'exclude' field so it doesn't break generic query logic)
    const remainingFilters = data.filters?.filter((f) => f.name !== 'exclude');
    const queryParams: Partial<GetAllRestQueryParams> = {
      ...data,
      filters: remainingFilters,
    };

    if (requestedFields.length > 0) {
      queryParams.fields = requestedFields;
    }

    applyRestQueryParams(qb, 'role', queryParams);

    // 4. Execute query
    const [roles, count] = await qb.getManyAndCount();

    return { roles, count };
  }

  async deleteRole(data: DeleteRoleDTO): Promise<void> {
    const role: RoleEntity = await this.findRoleById(data.id);
    const isRoleUsed: boolean = await UserService.isRoleUsed(role.id);
    if (isRoleUsed) {
      throw new BadRequestError('Cannot delete role that is assigned to users');
    }
    await this.roleRepository.remove(role);
  }

  private async isNameUsed(name: string, skipRoleId?: string): Promise<string | false> {
    try {
      const role: RoleEntity = await this.findRoleByName(name);
      if (!skipRoleId || role.id != skipRoleId) {
        return name; // Name found
      }
    } catch (error) {
      // Name not found
    }

    return false;
  }

  async deleteRoles(data: DeleteRolesDTO): Promise<void> {
    const roleIds: string[] = data.ids;
    if (!roleIds.length) return;

    const roles = await this.findRolesById(roleIds);

    // Check if any role is assigned to users
    for (const role of roles) {
      const isRoleUsed: boolean = await UserService.isRoleUsed(role.id);
      if (isRoleUsed) {
        throw new BadRequestError(`Cannot delete role "${role.name}" that is assigned to users`);
      }
    }

    await this.roleRepository.remove(roles);
  }

  async findAll(): Promise<RoleEntity[]> {
    return await this.roleRepository.find();
  }
}

export default new RoleService();
