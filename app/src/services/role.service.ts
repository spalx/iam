import { Repository } from 'typeorm';
import { NotFoundError, BadRequestError, GetAllRestQueryParams } from 'rest-pkg';
import { CreateRoleDTO, UpdateRoleDTO, GetRoleDTO, DeleteRoleDTO } from 'iam-pkg';

import RoleEntity from '@/entities/user/role.entity';
import appDataSource from '@/config/db.config';
import { applyRestQueryParams } from '@/common/utils';

class RoleService {
  private roleRepository: Repository<RoleEntity> = appDataSource.getRepository(RoleEntity);

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

  async getRoles(data: GetAllRestQueryParams): Promise<{ roles: RoleEntity[], count: number }> {
    const validFields = ['name', 'permissions'];

    // 1. Deduplicate and validate requested fields
    const requestedFields = Array.from(new Set(data.fields ?? [])).filter(f =>
      validFields.includes(f)
    );

    // 2. Start query builder
    let qb = this.roleRepository.createQueryBuilder('role');

    // 3. Call generic helper
    const queryParams: Partial<GetAllRestQueryParams> = { ...data };
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
}

export default new RoleService();
