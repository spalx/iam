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
import { CorrelatedMessage } from 'transport-pkg';
import { GetAllRestQueryParams, GetAllRestQueryParamsSchema, GetAllRestPaginatedResponse } from 'rest-pkg';

import userService from '@/services/user.service';

class UserController {
  async createUser(req: CorrelatedMessage<CreateUserDTO>): Promise<UserEntityDTO> {
    CreateUserDTOSchema.parse(req.data);

    const user = await userService.createUser(req.data);
    return user.output();
  }

  async getUser(req: CorrelatedMessage<GetUserDTO>): Promise<UserEntityDTO> {
    GetUserDTOSchema.parse(req.data);

    const user = await userService.getUser(req.data);
    return user.output();
  }

  async getUsers(req: CorrelatedMessage<GetAllRestQueryParams>): Promise<GetAllRestPaginatedResponse<UserEntityDTO>> {
    GetAllRestQueryParamsSchema.parse(req.data);

    const { users, count } = await userService.getUsers(req.data);
    return { results: users.map(user => user.output()), count };
  }

  async deleteUser(req: CorrelatedMessage<DeleteUserDTO>): Promise<void> {
    DeleteUserDTOSchema.parse(req.data);

    await userService.deleteUser(req.data);
  }

  async updateUser(dto: CorrelatedMessage<UpdateUserDTO>): Promise<UserEntityDTO> {
    UpdateUserDTOSchema.parse(dto.data);

    const user = await userService.updateUser(dto.data);
    return user.output();
  }
}

export default new UserController();
