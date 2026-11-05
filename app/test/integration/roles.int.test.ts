import { GetAllRestQueryParams, RestFilterField, RestFilterFieldOperator } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import roleController from '@/controllers/role.controller';
import RoleEntity from '@/entities/user/role.entity';
import { saveRole, saveUser } from '../factories/iam.factory';

function request<T>(data: T): never {
  return { id: 'c0ffee00-0000-4000-8000-000000000001', data } as never;
}

async function roleNames(): Promise<string[]> {
  const rows = await appDataSource.query<{ name: string }[]>('SELECT name FROM roles ORDER BY name');
  return rows.map((row) => row.name);
}

async function paginated(params: GetAllRestQueryParams): Promise<{ names: string[]; count: number }> {
  const { results, count } = await roleController.getRoles(request({ paginated: true, ...params }));
  return { names: results.map((role) => role.name), count };
}

function filter(operator: RestFilterFieldOperator, ...values: string[]): RestFilterField {
  return { name: 'name', operator, values };
}

describe('changes', () => {
  it('should create a role, and refuse a second one with its name', async () => {
    // Act
    const created = await roleController.createRole(request({ name: 'admin', permissions: ['users.read'] }));

    // Assert
    expect(created).toEqual({ id: expect.any(String), name: 'admin', permissions: ['users.read'] });
    await expect(roleController.createRole(request({ name: 'admin', permissions: ['x'] }))).rejects.toThrow(
      'Role with name admin already exists'
    );
    expect(await roleNames()).toEqual(['admin']);
  });

  it("should rename a role and change its permissions, but refuse another role's name", async () => {
    const admin = await saveRole({ name: 'admin' });
    await saveRole({ name: 'agent' });

    await roleController.updateRole(request({ id: admin.id, name: 'manager', permissions: ['users.write'] }));
    await expect(roleController.updateRole(request({ id: admin.id, name: 'agent' }))).rejects.toThrow(
      'Role with name agent already exists'
    );

    expect(await roleController.getRole(request({ id: admin.id }))).toEqual({
      id: admin.id,
      name: 'manager',
      permissions: ['users.write'],
    });
  });

  it('should refuse to delete a role a user has, alone or among others', async () => {
    const admin = await saveRole({ name: 'admin' });
    const unused = await saveRole({ name: 'unused' });
    await saveUser({ identities: ['dana@example.com'], roles: [admin] });

    await expect(roleController.deleteRole(request({ id: admin.id }))).rejects.toThrow(
      'Cannot delete role that is assigned to users'
    );
    await expect(roleController.deleteRoles(request({ ids: [unused.id, admin.id] }))).rejects.toThrow(
      'Cannot delete role "admin" that is assigned to users'
    );
    expect(await roleNames()).toEqual(['admin', 'unused']);
  });

  it('should delete nothing when one of the ids is unknown, and delete all of them otherwise', async () => {
    const admin = await saveRole({ name: 'admin' });
    const agent = await saveRole({ name: 'agent' });

    await expect(
      roleController.deleteRoles(request({ ids: [admin.id, 'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b'] }))
    ).rejects.toThrow('One or more roles not found');
    expect(await roleNames()).toEqual(['admin', 'agent']);

    await roleController.deleteRoles(request({ ids: [admin.id, agent.id] }));
    expect(await roleNames()).toEqual([]);
  });
});

describe('list', () => {
  let roles: RoleEntity[];

  beforeEach(async () => {
    roles = [];
    for (const name of ['admin', 'agent', 'manager', 'viewer']) {
      roles.push(await saveRole({ name }));
    }
  });

  it('should return every role without paginated', async () => {
    const { results, count } = await roleController.getRoles(request({ limit: 1 }));

    expect(results.map((role) => role.name).sort()).toEqual(['admin', 'agent', 'manager', 'viewer']);
    expect(count).toBe(4);
  });

  it('should order by id, highest first, ten to a page by default', async () => {
    // Arrange
    for (let i = 0; i < 8; i++) {
      await saveRole({ name: `extra-${i}` });
    }
    const byIdDesc = (await appDataSource.query<{ name: string }[]>('SELECT name FROM roles ORDER BY id DESC')).map(
      (row) => row.name
    );

    // Act and Assert
    expect(await paginated({})).toEqual({ names: byIdDesc.slice(0, 10), count: 12 });
    expect(await paginated({ page: 2 })).toEqual({ names: byIdDesc.slice(10), count: 12 });
  });

  it('should sort and page as asked', async () => {
    expect(await paginated({ sort: [{ sort_by: 'name', sort_direction: -1 }], page: 2, limit: 2 })).toEqual({
      names: ['agent', 'admin'],
      count: 4,
    });
  });

  it('should leave out the excluded names', async () => {
    const { names } = await paginated({
      filters: [{ name: 'exclude', operator: RestFilterFieldOperator.In, values: ['admin', 'viewer'] }],
      sort: [{ sort_by: 'name', sort_direction: 1 }],
    });

    expect(names).toEqual(['agent', 'manager']);
  });

  // Pinned as found: only the selected columns are loaded, so the output has no id.
  it('should load only the allowed fields asked for', async () => {
    const { results } = await roleController.getRoles(
      request({ paginated: true, fields: ['name', 'id'], sort: [{ sort_by: 'name', sort_direction: 1 }], limit: 1 })
    );

    expect(results).toEqual([{ id: undefined, name: 'admin', permissions: undefined }]);
  });

  it.each<[string, RestFilterField, string[]]>([
    ['Contains', filter(RestFilterFieldOperator.Contains, 'AG'), ['agent', 'manager']],
    ['NotContains', filter(RestFilterFieldOperator.NotContains, 'a'), ['viewer']],
    ['StartsWith', filter(RestFilterFieldOperator.StartsWith, 'A'), ['admin', 'agent']],
    ['EndsWith', filter(RestFilterFieldOperator.EndsWith, 'ER'), ['manager', 'viewer']],
    ['Equal', filter(RestFilterFieldOperator.Equal, 'agent'), ['agent']],
    ['Unequal', filter(RestFilterFieldOperator.Unequal, 'agent'), ['admin', 'manager', 'viewer']],
    ['In', filter(RestFilterFieldOperator.In, 'admin', 'viewer'), ['admin', 'viewer']],
    ['NotIn', filter(RestFilterFieldOperator.NotIn, 'admin', 'viewer'), ['agent', 'manager']],
    ['Between', filter(RestFilterFieldOperator.Between, 'agent', 'manager'), ['agent', 'manager']],
    ['GreaterThan', filter(RestFilterFieldOperator.GreaterThan, 'manager'), ['viewer']],
    ['LessThan', filter(RestFilterFieldOperator.LessThan, 'agent'), ['admin']],
    ['GreaterOrEqualThan', filter(RestFilterFieldOperator.GreaterOrEqualThan, 'manager'), ['manager', 'viewer']],
    ['LessOrEqualThan', filter(RestFilterFieldOperator.LessOrEqualThan, 'agent'), ['admin', 'agent']],
  ])('should filter names with %s', async (_name, nameFilter, expected) => {
    const { names } = await paginated({ filters: [nameFilter], sort: [{ sort_by: 'name', sort_direction: 1 }] });

    expect(names).toEqual(expected);
  });

  it('should return every field when none of the fields asked for is allowed', async () => {
    const { results } = await roleController.getRoles(
      request({
        paginated: true,
        fields: ['(SELECT password FROM users LIMIT 1)'],
        sort: [{ sort_by: 'name', sort_direction: 1 }],
        limit: 1,
      })
    );

    expect(results).toEqual([{ id: roles[0].id, name: 'admin', permissions: ['admin.all'] }]);
  });

  it('should refuse a sort or filter name it does not offer, and leave the table as it was', async () => {
    await expect(paginated({ sort: [{ sort_by: 'name; DROP TABLE roles', sort_direction: 1 }] })).rejects.toThrow(
      'Unknown sort field name; DROP TABLE roles'
    );
    await expect(
      paginated({ filters: [{ name: 'permissions', operator: RestFilterFieldOperator.Equal, values: ['x'] }] })
    ).rejects.toThrow('Unknown filter field permissions');

    expect(await roleNames()).toEqual(['admin', 'agent', 'manager', 'viewer']);
  });

  it('should match a value that looks like SQL only literally', async () => {
    expect((await paginated({ filters: [filter(RestFilterFieldOperator.Equal, "x' OR '1'='1")] })).names).toEqual([]);

    await saveRole({ name: "x' OR '1'='1" });

    expect((await paginated({ filters: [filter(RestFilterFieldOperator.Equal, "x' OR '1'='1")] })).names).toEqual([
      "x' OR '1'='1",
    ]);
  });

  it('should refuse an operator the query schema does not know', async () => {
    await expect(paginated({ filters: [{ name: 'name', operator: 'Like' as never, values: ['x'] }] })).rejects.toThrow(
      'Invalid option'
    );
  });
});
