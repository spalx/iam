import UsersDatasource from '@/datasources/users.datasource';
import RoleEntity from '@/entities/user/role.entity';
import UserEntity from '@/entities/user/user.entity';
import userService from '@/services/user.service';
import userController from './user.controller';

// A request the DTO schema refuses.
const INVALID = { name: 'ZodError' };

jest.mock('@/services/user.service', () => ({
  __esModule: true,
  default: { createUser: jest.fn(), getUser: jest.fn(), deleteUser: jest.fn(), updateUser: jest.fn() },
}));

jest.mock('@/datasources/users.datasource', () => {
  const output = jest.fn();
  return { __esModule: true, default: jest.fn().mockImplementation(() => ({ output })) };
});

const USER_ID = '6a1f2c3d-8e4b-4f5a-9b6c-7d8e9f0a1b2c';

function buildUser(id = USER_ID): UserEntity {
  const role = Object.assign(new RoleEntity(), { id: 'role-1', name: 'admin', permissions: ['admin.all'] });
  return Object.assign(new UserEntity(), { id, roles: [role], meta: { first_name: 'Dana' } });
}

function request<T>(data: T): never {
  return { id: 'c0ffee00-0000-4000-8000-000000000001', data } as never;
}

function datasourceOutput(): jest.Mock {
  return new (UsersDatasource as unknown as new () => { output: jest.Mock })().output;
}

describe('UserController - createUser', () => {
  it('should create a valid user and return its output', async () => {
    // Arrange
    const data = { identities: ['dana@example.com'], roles: ['admin'], password: 'secret' };
    jest.mocked(userService.createUser).mockResolvedValueOnce(buildUser());

    // Act
    const result = await userController.createUser(request(data));

    // Assert
    expect(result).toEqual(buildUser().output());
    expect(userService.createUser).toHaveBeenCalledWith(data);
  });

  it.each([
    { identities: [], roles: ['admin'] },
    { identities: ['dana@example.com'], roles: [] },
    { identities: ['dana@example.com'], roles: ['admin'], is_active: 'yes' },
  ])('should refuse %p before calling the service', async (data) => {
    await expect(userController.createUser(request(data))).rejects.toMatchObject(INVALID);
    expect(userService.createUser).not.toHaveBeenCalled();
  });
});

describe('UserController - getUser', () => {
  it.each([{ id: USER_ID }, { identity: 'dana@example.com' }])(
    'should return the output of the user found by %p',
    async (data) => {
      jest.mocked(userService.getUser).mockResolvedValueOnce(buildUser());

      await expect(userController.getUser(request(data))).resolves.toEqual(buildUser().output());
      expect(userService.getUser).toHaveBeenCalledWith(data);
    }
  );

  it.each([{}, { id: 'not-a-uuid' }])('should refuse %p before calling the service', async (data) => {
    await expect(userController.getUser(request(data))).rejects.toMatchObject(INVALID);
    expect(userService.getUser).not.toHaveBeenCalled();
  });
});

describe('UserController - getUsers', () => {
  it('should list through the datasource and return each user output and the count', async () => {
    // Arrange
    const data = { page: 1, limit: 10 };
    const users = [buildUser(), buildUser('7b2e3d4f-9f5c-4a6b-8c7d-8e9f0a1b2c3d')];
    datasourceOutput().mockResolvedValueOnce([users, 12]);

    // Act
    const result = await userController.getUsers(request(data));

    // Assert
    expect(result).toEqual({ results: users.map((user) => user.output()), count: 12 });
    expect(UsersDatasource).toHaveBeenLastCalledWith(data);
  });

  it('should refuse an invalid query before building the datasource', async () => {
    jest.mocked(UsersDatasource).mockClear();

    await expect(userController.getUsers(request({ limit: 0 }))).rejects.toMatchObject(INVALID);
    expect(UsersDatasource).not.toHaveBeenCalled();
  });
});

describe('UserController - updateUser', () => {
  it('should update a valid user and return its output', async () => {
    const data = { id: USER_ID, is_active: false };
    jest.mocked(userService.updateUser).mockResolvedValueOnce(buildUser());

    await expect(userController.updateUser(request(data))).resolves.toEqual(buildUser().output());
    expect(userService.updateUser).toHaveBeenCalledWith(data);
  });

  it('should refuse an id that is not a uuid before calling the service', async () => {
    await expect(userController.updateUser(request({ id: '7' }))).rejects.toMatchObject(INVALID);
    expect(userService.updateUser).not.toHaveBeenCalled();
  });
});

describe('UserController - deleteUser', () => {
  it('should delete the user by id', async () => {
    await expect(userController.deleteUser(request({ id: USER_ID }))).resolves.toBeUndefined();
    expect(userService.deleteUser).toHaveBeenCalledWith({ id: USER_ID });
  });

  it('should refuse a missing id before calling the service', async () => {
    await expect(userController.deleteUser(request({}))).rejects.toMatchObject(INVALID);
    expect(userService.deleteUser).not.toHaveBeenCalled();
  });
});
