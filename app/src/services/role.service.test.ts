import { In } from 'typeorm';
import { BadRequestError, NotFoundError, RestFilterFieldOperator } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import { applyRestQueryParams } from '@/common/utils';
import RoleEntity from '@/entities/user/role.entity';
import userService from '@/services/user.service';
import roleService from './role.service';

jest.mock('@/common/db/app-data-source', () => ({
  __esModule: true,
  default: { getRepository: jest.fn() },
}));

jest.mock('@/common/utils', () => ({
  ...jest.requireActual<object>('@/common/utils'),
  applyRestQueryParams: jest.fn(),
}));

const ROLE_ID = '0b6c7c1e-4a6f-4d2b-9a1e-3f2d1c0b9a87';
const OTHER_ID = '1c7d8e2f-5b70-4e3c-8b2f-4031e2d1cab8';

const qb = { andWhere: jest.fn(), getManyAndCount: jest.fn() };
const roleRepository = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};
let roleSave: jest.SpyInstance;

function buildRole(name: string, id = ROLE_ID): RoleEntity {
  return Object.assign(new RoleEntity(), { id, name, permissions: [`${name}.all`] });
}

beforeEach(() => {
  // Drops any one-off value a test arranged and didn't use.
  [...Object.values(roleRepository), ...Object.values(qb)].forEach((mock) => mock.mockReset());
  jest.mocked(appDataSource.getRepository).mockReturnValue(roleRepository as never);
  roleRepository.createQueryBuilder.mockReturnValue(qb);
  roleRepository.findOne.mockResolvedValue(null);
  qb.getManyAndCount.mockResolvedValue([[], 0]);
  roleSave = jest.spyOn(RoleEntity.prototype, 'save').mockImplementation(async function (this: never) {
    return this;
  });
  jest.spyOn(userService, 'isRoleUsed').mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RoleService - lookups', () => {
  it('should find a role by name', async () => {
    const role = buildRole('admin');
    roleRepository.findOne.mockResolvedValueOnce(role);

    await expect(roleService.findRoleByName('admin')).resolves.toBe(role);
    expect(roleRepository.findOne).toHaveBeenCalledWith({ where: { name: 'admin' } });
  });

  it('should find a role by id', async () => {
    const role = buildRole('admin');
    roleRepository.findOneBy.mockResolvedValueOnce(role);

    await expect(roleService.findRoleById(ROLE_ID)).resolves.toBe(role);
    expect(roleRepository.findOneBy).toHaveBeenCalledWith({ id: ROLE_ID });
  });

  it.each<[string, () => Promise<unknown>]>([
    ['name', () => roleService.findRoleByName('nobody')],
    ['id', () => roleService.findRoleById(ROLE_ID)],
  ])('should refuse an unknown %s', async (_name, find) => {
    roleRepository.findOneBy.mockResolvedValueOnce(null);

    await expect(find()).rejects.toStrictEqual(new NotFoundError('Role not found'));
  });

  it('should find every role in a list of ids', async () => {
    const roles = [buildRole('admin'), buildRole('agent', OTHER_ID)];
    roleRepository.findBy.mockResolvedValueOnce(roles);

    await expect(roleService.findRolesById([ROLE_ID, OTHER_ID])).resolves.toBe(roles);
    expect(roleRepository.findBy).toHaveBeenCalledWith({ id: In([ROLE_ID, OTHER_ID]) });
  });

  it('should refuse a list of ids when one is unknown', async () => {
    roleRepository.findBy.mockResolvedValueOnce([buildRole('admin')]);

    await expect(roleService.findRolesById([ROLE_ID, OTHER_ID])).rejects.toStrictEqual(
      new NotFoundError('One or more roles not found')
    );
  });

  it('should return every role', async () => {
    const roles = [buildRole('admin')];
    roleRepository.find.mockResolvedValueOnce(roles);

    await expect(roleService.findAll()).resolves.toBe(roles);
  });

  it('should get a role by name when one is given, by id otherwise, and refuse neither', async () => {
    const byName = buildRole('admin');
    const byId = buildRole('agent');
    roleRepository.findOne.mockResolvedValueOnce(byName);
    roleRepository.findOneBy.mockResolvedValueOnce(byId);

    await expect(roleService.getRole({ name: 'admin' })).resolves.toBe(byName);
    await expect(roleService.getRole({ id: ROLE_ID })).resolves.toBe(byId);
    await expect(roleService.getRole({} as never)).rejects.toStrictEqual(new NotFoundError('Role not found'));
  });
});

describe('RoleService - createRole', () => {
  it('should save a role with a new name', async () => {
    // Act
    const role = await roleService.createRole({ name: 'admin', permissions: ['users.read'] });

    // Assert
    expect(role).toMatchObject({ name: 'admin', permissions: ['users.read'] });
    expect(roleSave.mock.instances).toEqual([role]);
  });

  it('should refuse a name in use, and save nothing', async () => {
    roleRepository.findOne.mockResolvedValueOnce(buildRole('admin', OTHER_ID));

    await expect(roleService.createRole({ name: 'admin', permissions: ['users.read'] })).rejects.toStrictEqual(
      new BadRequestError('Role with name admin already exists')
    );
    expect(roleSave).not.toHaveBeenCalled();
  });
});

describe('RoleService - updateRole', () => {
  let role: RoleEntity;

  beforeEach(() => {
    role = buildRole('admin');
    roleRepository.findOneBy.mockResolvedValue(role);
  });

  it('should rename the role and replace its permissions', async () => {
    await roleService.updateRole({ id: ROLE_ID, name: 'manager', permissions: ['users.write'] });

    expect(role).toMatchObject({ name: 'manager', permissions: ['users.write'] });
    expect(roleSave.mock.instances).toEqual([role]);
  });

  it('should let a role keep its own name', async () => {
    roleRepository.findOne.mockResolvedValueOnce(role);

    await roleService.updateRole({ id: ROLE_ID, name: 'admin' });

    expect(roleSave).toHaveBeenCalledTimes(1);
  });

  it('should leave the name and permissions when they are not given', async () => {
    await roleService.updateRole({ id: ROLE_ID });

    expect(role).toMatchObject({ name: 'admin', permissions: ['admin.all'] });
    expect(roleRepository.findOne).not.toHaveBeenCalled();
  });

  it("should refuse another role's name, and save nothing", async () => {
    roleRepository.findOne.mockResolvedValueOnce(buildRole('agent', OTHER_ID));

    await expect(roleService.updateRole({ id: ROLE_ID, name: 'agent' })).rejects.toStrictEqual(
      new BadRequestError('Role with name agent already exists')
    );
    expect(role.name).toBe('admin');
    expect(roleSave).not.toHaveBeenCalled();
  });

  it('should refuse an unknown role', async () => {
    roleRepository.findOneBy.mockResolvedValueOnce(null);

    await expect(roleService.updateRole({ id: OTHER_ID })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RoleService - deleteRole and deleteRoles', () => {
  it('should remove a role nobody has', async () => {
    const role = buildRole('admin');
    roleRepository.findOneBy.mockResolvedValueOnce(role);

    await roleService.deleteRole({ id: ROLE_ID });

    expect(userService.isRoleUsed).toHaveBeenCalledWith(ROLE_ID);
    expect(roleRepository.remove).toHaveBeenCalledWith(role);
  });

  it('should refuse to remove a role a user has', async () => {
    roleRepository.findOneBy.mockResolvedValueOnce(buildRole('admin'));
    jest.mocked(userService.isRoleUsed).mockResolvedValueOnce(true);

    await expect(roleService.deleteRole({ id: ROLE_ID })).rejects.toStrictEqual(
      new BadRequestError('Cannot delete role that is assigned to users')
    );
    expect(roleRepository.remove).not.toHaveBeenCalled();
  });

  it('should remove several roles nobody has, together', async () => {
    const roles = [buildRole('admin'), buildRole('agent', OTHER_ID)];
    roleRepository.findBy.mockResolvedValueOnce(roles);

    await roleService.deleteRoles({ ids: [ROLE_ID, OTHER_ID] });

    expect(roleRepository.remove).toHaveBeenCalledWith(roles);
  });

  it('should remove nothing when one of several roles is in use', async () => {
    roleRepository.findBy.mockResolvedValueOnce([buildRole('admin'), buildRole('agent', OTHER_ID)]);
    jest.mocked(userService.isRoleUsed).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(roleService.deleteRoles({ ids: [ROLE_ID, OTHER_ID] })).rejects.toStrictEqual(
      new BadRequestError('Cannot delete role "agent" that is assigned to users')
    );
    expect(roleRepository.remove).not.toHaveBeenCalled();
  });

  it('should do nothing for an empty list', async () => {
    await roleService.deleteRoles({ ids: [] });

    expect(roleRepository.findBy).not.toHaveBeenCalled();
    expect(roleRepository.remove).not.toHaveBeenCalled();
  });
});

describe('RoleService - getRoles', () => {
  it('should hand the query to applyRestQueryParams and return the page and the count', async () => {
    // Arrange
    const roles = [buildRole('admin')];
    qb.getManyAndCount.mockResolvedValueOnce([roles, 4]);
    const filters = [{ name: 'name', operator: RestFilterFieldOperator.Contains, values: ['adm'] }];

    // Act
    const result = await roleService.getRoles({ page: 2, limit: 1, filters });

    // Assert
    expect(result).toEqual({ roles, count: 4 });
    expect(roleRepository.createQueryBuilder).toHaveBeenCalledWith('role');
    expect(applyRestQueryParams).toHaveBeenCalledWith(qb, 'role', { page: 2, limit: 1, filters });
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('should turn exclude into a NOT IN and keep it out of the other filters', async () => {
    const name = { name: 'name', operator: RestFilterFieldOperator.StartsWith, values: ['a'] };

    await roleService.getRoles({
      filters: [{ name: 'exclude', operator: RestFilterFieldOperator.In, values: ['root', 'system'] }, name],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('role.name NOT IN (:...excludeRoles)', {
      excludeRoles: ['root', 'system'],
    });
    expect(jest.mocked(applyRestQueryParams).mock.calls[0][2].filters).toEqual([name]);
  });

  it('should split an exclude given as one comma-separated string', async () => {
    await roleService.getRoles({
      filters: [{ name: 'exclude', operator: RestFilterFieldOperator.In, values: 'root, system' as never }],
    });

    expect(qb.andWhere).toHaveBeenCalledWith('role.name NOT IN (:...excludeRoles)', {
      excludeRoles: ['root', 'system'],
    });
  });

  it('should ignore an empty exclude', async () => {
    await roleService.getRoles({ filters: [{ name: 'exclude', operator: RestFilterFieldOperator.In, values: [] }] });

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(jest.mocked(applyRestQueryParams).mock.calls[0][2].filters).toEqual([]);
  });

  it('should keep only name and permissions among the requested fields, once each', async () => {
    await roleService.getRoles({ fields: ['name', 'secret', 'permissions', 'name'] });

    expect(jest.mocked(applyRestQueryParams).mock.calls[0][2].fields).toEqual(['name', 'permissions']);
  });

  it('should pass the fields through untouched when none of them are allowed', async () => {
    await roleService.getRoles({ fields: ['secret'] });

    expect(jest.mocked(applyRestQueryParams).mock.calls[0][2].fields).toEqual(['secret']);
  });
});
