import {
  CreateUserDTO,
  UserEntityDTO,
  CreateUserDTOSchema,
  GetUserDTO,
  GetUserDTOSchema,
  DeleteUserDTO,
  DeleteUserDTOSchema,
  UpdateUserDTO,
  UpdateUserDTOSchema
} from 'iam-pkg';
import { CorrelatedRequestDTO, CorrelatedRequestDTOSchema, transportService } from 'transport-pkg';
import { GetAllRestQueryParams, GetAllRestQueryParamsSchema, GetAllRestPaginatedResponse } from 'rest-pkg';

import userService from '@/services/user.service';

class UserController {
  async createUser(dto: CorrelatedRequestDTO<CreateUserDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: UserEntityDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      CreateUserDTOSchema.parse(dto.data);

      const user = await userService.createUser(dto.data);
      responseData = user.output();
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async getUser(dto: CorrelatedRequestDTO<GetUserDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: UserEntityDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      GetUserDTOSchema.parse(dto.data);

      const user = await userService.getUser(dto.data);
      responseData = user.output();
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async getUsers(dto: CorrelatedRequestDTO<GetAllRestQueryParams>): Promise<void> {
    let error: unknown | null = null;
    let responseData: GetAllRestPaginatedResponse<UserEntityDTO> | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      GetAllRestQueryParamsSchema.parse(dto.data);

      const { users, count } = await userService.getUsers(dto.data);
      responseData = { results: users.map(user => user.output()), count };
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }

  async deleteUser(dto: CorrelatedRequestDTO<DeleteUserDTO>): Promise<void> {
    let error: unknown | null = null;

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      DeleteUserDTOSchema.parse(dto.data);

      await userService.deleteUser(dto.data);
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, {}, error);
    }
  }

  async updateUser(dto: CorrelatedRequestDTO<UpdateUserDTO>): Promise<void> {
    let error: unknown | null = null;
    let responseData: UserEntityDTO | {} = {};

    try {
      CorrelatedRequestDTOSchema.parse(dto);
      UpdateUserDTOSchema.parse(dto.data);

      const user = await userService.updateUser(dto.data);
      responseData = user.output();
    } catch (err) {
      error = err;
    } finally {
      await transportService.sendResponseForRequest(dto, responseData, error);
    }
  }
}

export default new UserController();
