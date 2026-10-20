import RoleEntity from '@/entities/user/role.entity';
import roleService from '@/services/role.service';
import roleController from './role.controller';

// A request the DTO schema refuses.
const INVALID = { name: 'ZodError' };

jest.mock('@/services/role.service', () => ({
  __esModule: true,
  default: {
    createRole: jest.fn(),
    getRole: jest.fn(),
    getRoles: jest.fn(),
    findAll: jest.fn(),
    deleteRole: jest.fn(),
    deleteRoles: jest.fn(),
    updateRole: jest.fn(),
  },
}));

const ROLE_ID = '0b6c7c1e-4a6f-4d2b-9a1e-3f2d1c0b9a87';

function buildRole(name: string, id = ROLE_ID): RoleEntity {
  return Object.assign(new RoleEntity(), { id, name, permissions: [`${name}.all`] });
}

function request<T>(data: T): never {
  return { id: 'c0ffee00-0000-4000-8000-000000000001', data } as never;
}

describe('RoleController - createRole', () => {
  it('should create a valid role and return its output', async () => {
    // Arrange
    const data = { name: 'admin', permissions: ['admin.all'] };
    jest.mocked(roleService.createRole).mockResolvedValueOnce(buildRole('admin'));

    // Act
    const result = await roleController.createRole(request(data));

    // Assert
    expect(result).toEqual({ id: ROLE_ID, name: 'admin', permissions: ['admin.all'] });
    expect(roleService.createRole).toHaveBeenCalledWith(data);
  });

  it.each([{ name: 'admin', permissions: [] }, { name: '', permissions: ['a'] }, { permissions: ['a'] }])(
    'should refuse %p before calling the service',
    async (data) => {
      await expect(roleController.createRole(request(data))).rejects.toMatchObject(INVALID);
      expect(roleService.createRole).not.toHaveBeenCalled();
    }
  );
});

describe('RoleController - getRole', () => {
  it.each([{ id: ROLE_ID }, { name: 'admin' }])('should return the output of the role found by %p', async (data) => {
    jest.mocked(roleService.getRole).mockResolvedValueOnce(buildRole('admin'));

    await expect(roleController.getRole(request(data))).resolves.toEqual(buildRole('admin').output());
    expect(roleService.getRole).toHaveBeenCalledWith(data);
  });

  it.each([{}, { id: 'not-a-uuid' }, { id: ROLE_ID, name: 'admin' }])(
    'should refuse %p before calling the service',
    async (data) => {
      await expect(roleController.getRole(request(data))).rejects.toMatchObject(INVALID);
      expect(roleService.getRole).not.toHaveBeenCalled();
    }
  );
});

describe('RoleController - getRoles', () => {
  const roles = [buildRole('admin'), buildRole('agent', '1c7d8e2f-5b70-4e3c-8b2f-4031e2d1cab8')];

  it('should return every role, and count them, when the request is not paginated', async () => {
    // Arrange
    jest.mocked(roleService.findAll).mockResolvedValueOnce(roles);

    // Act
    const result = await roleController.getRoles(request({ page: 2, limit: 1 }));

    // Assert
    expect(result).toEqual({ results: roles.map((role) => role.output()), count: 2 });
    expect(roleService.getRoles).not.toHaveBeenCalled();
  });

  it('should return every role when paginated is false', async () => {
    jest.mocked(roleService.findAll).mockResolvedValueOnce(roles);

    await roleController.getRoles(request({ paginated: false }));

    expect(roleService.getRoles).not.toHaveBeenCalled();
  });

  it('should return the page and the total count when the request is paginated', async () => {
    const data = { paginated: true, page: 1, limit: 1 };
    jest.mocked(roleService.getRoles).mockResolvedValueOnce({ roles: [roles[0]], count: 2 });

    const result = await roleController.getRoles(request(data));

    expect(result).toEqual({ results: [roles[0].output()], count: 2 });
    expect(roleService.getRoles).toHaveBeenCalledWith(data);
    expect(roleService.findAll).not.toHaveBeenCalled();
  });

  it.each([{ page: 0 }, { limit: -1 }, { paginated: 'true' }])('should refuse %p', async (data) => {
    await expect(roleController.getRoles(request(data))).rejects.toMatchObject(INVALID);
    expect(roleService.getRoles).not.toHaveBeenCalled();
    expect(roleService.findAll).not.toHaveBeenCalled();
  });
});

describe('RoleController - updateRole', () => {
  it('should update a valid role and return its output', async () => {
    const data = { id: ROLE_ID, name: 'manager' };
    jest.mocked(roleService.updateRole).mockResolvedValueOnce(buildRole('manager'));

    await expect(roleController.updateRole(request(data))).resolves.toEqual(buildRole('manager').output());
    expect(roleService.updateRole).toHaveBeenCalledWith(data);
  });

  it('should refuse an id that is not a uuid before calling the service', async () => {
    await expect(roleController.updateRole(request({ id: '7', name: 'manager' }))).rejects.toMatchObject(INVALID);
    expect(roleService.updateRole).not.toHaveBeenCalled();
  });
});

describe('RoleController - deleteRole and deleteRoles', () => {
  it('should delete one role by id', async () => {
    await expect(roleController.deleteRole(request({ id: ROLE_ID }))).resolves.toBeUndefined();
    expect(roleService.deleteRole).toHaveBeenCalledWith({ id: ROLE_ID });
  });

  it('should refuse a missing id before calling the service', async () => {
    await expect(roleController.deleteRole(request({}))).rejects.toMatchObject(INVALID);
    expect(roleService.deleteRole).not.toHaveBeenCalled();
  });

  it('should delete several roles by id', async () => {
    await expect(roleController.deleteRoles(request({ ids: [ROLE_ID] }))).resolves.toBeUndefined();
    expect(roleService.deleteRoles).toHaveBeenCalledWith({ ids: [ROLE_ID] });
  });

  it('should refuse an empty list before calling the service', async () => {
    await expect(roleController.deleteRoles(request({ ids: [] }))).rejects.toMatchObject(INVALID);
    expect(roleService.deleteRoles).not.toHaveBeenCalled();
  });
});
