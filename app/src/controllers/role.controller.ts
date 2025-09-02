import {
  CreateRoleDTO,
  RoleEntityDTO,
  CreateRoleDTOSchema,
  GetRoleDTO,
  GetRoleDTOSchema,
  DeleteRoleDTO,
  DeleteRoleDTOSchema,
  UpdateRoleDTO,
  UpdateRoleDTOSchema
} from 'iam-pkg';
import { CorrelatedRequestDTO, CorrelatedRequestDTOSchema, transportService } from 'transport-pkg';
import { GetAllRestQueryParams, GetAllRestQueryParamsSchema, GetAllRestPaginatedResponse } from 'rest-pkg';

import roleService from '@/services/role.service';

class RoleController {
  async createRole(dto: CorrelatedRequestDTO<CreateRoleDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: RoleEntityDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      CreateRoleDTOSchema.parse(dto.data);

      const role = await roleService.createRole(dto.data);
      responseData = role.output();
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async getRole(dto: CorrelatedRequestDTO<GetRoleDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: RoleEntityDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      GetRoleDTOSchema.parse(dto.data);

      const role = await roleService.getRole(dto.data);
      responseData = role.output();
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async getRoles(dto: CorrelatedRequestDTO<GetAllRestQueryParams>): Promise<void> {
    let error: unknown | null = null;
    let responseData: GetAllRestPaginatedResponse<RoleEntityDTO> | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      GetAllRestQueryParamsSchema.parse(dto.data);

      const { roles, count } = await roleService.getRoles(dto.data);
      responseData = { results: roles.map(role => role.output()), count };
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async deleteRole(dto: CorrelatedRequestDTO<DeleteRoleDTO>): Promise<void> {
    let error: unknown | null = null;

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      DeleteRoleDTOSchema.parse(dto.data);

      await roleService.deleteRole(dto.data);
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, {}, error);
    }
  }

  async updateRole(dto: CorrelatedRequestDTO<UpdateRoleDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: RoleEntityDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      UpdateRoleDTOSchema.parse(dto.data);

      const role = await roleService.updateRole(dto.data);
      responseData = role.output();
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }
}

export default new RoleController();
