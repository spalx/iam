import {
  CreateRoleDTO,
  RoleEntityDTO,
  CreateRoleDTOSchema,
  GetRoleDTO,
  GetRoleDTOSchema,
  DeleteRoleDTO,
  DeleteRoleDTOSchema,
  UpdateRoleDTO,
  UpdateRoleDTOSchema,
  DeleteRolesDTO,
  DeleteRolesDTOSchema,
} from '@spalx/iam-pkg';
import { CorrelatedMessage } from '@spalx/transport-pkg';
import { GetAllRestQueryParams, GetAllRestQueryParamsSchema, GetAllRestPaginatedResponse } from '@spalx/rest-pkg';

import roleService from '@/services/role.service';

class RoleController {
  async createRole(req: CorrelatedMessage<CreateRoleDTO>): Promise<RoleEntityDTO> {
    CreateRoleDTOSchema.parse(req.data);

    const role = await roleService.createRole(req.data);
    return role.output();
  }

  async getRole(req: CorrelatedMessage<GetRoleDTO>): Promise<RoleEntityDTO> {
    GetRoleDTOSchema.parse(req.data);

    const role = await roleService.getRole(req.data);
    return role.output();
  }

  async getRoles(
    req: CorrelatedMessage<GetAllRestQueryParams & { paginated?: string | boolean }>
  ): Promise<GetAllRestPaginatedResponse<RoleEntityDTO>> {
    GetAllRestQueryParamsSchema.parse(req.data);
    const isPaginated = req.data.paginated;

    if (isPaginated) {
      const { roles, count } = await roleService.getRoles(req.data);
      return { results: roles.map((role) => role.output()), count };
    }
    const roles = await roleService.findAll();
    return { results: roles.map((role) => role.output()), count: roles.length };
  }

  async deleteRole(req: CorrelatedMessage<DeleteRoleDTO>): Promise<void> {
    DeleteRoleDTOSchema.parse(req.data);
    await roleService.deleteRole(req.data);
  }

  async deleteRoles(req: CorrelatedMessage<DeleteRolesDTO>): Promise<void> {
    DeleteRolesDTOSchema.parse(req.data);
    await roleService.deleteRoles(req.data);
  }

  async updateRole(req: CorrelatedMessage<UpdateRoleDTO>): Promise<RoleEntityDTO> {
    UpdateRoleDTOSchema.parse(req.data);

    const role = await roleService.updateRole(req.data);
    return role.output();
  }
}

export default new RoleController();
