import { GetAllRestQueryParams, RestFilterFieldOperator } from '@spalx/rest-pkg';

import appDataSource from '@/common/db/app-data-source';
import { sha256 } from '@/common/utils';
import authController from '@/controllers/auth.controller';
import userController from '@/controllers/user.controller';
import RoleEntity from '@/entities/user/role.entity';
import UserEntity from '@/entities/user/user.entity';
import { saveRole, saveUser } from '../factories/iam.factory';

const PASSWORD = 'correct horse';

function request<T>(data: T): never {
  return { id: 'c0ffee00-0000-4000-8000-000000000001', data } as never;
}

async function count(table: string): Promise<number> {
  const [row] = await appDataSource.query<{ count: string }[]>(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(row.count);
}

async function rawUser(id: string): Promise<Record<string, unknown>> {
  const [row] = await appDataSource.query<Record<string, unknown>[]>('SELECT * FROM users WHERE id = $1', [id]);
  return row;
}

async function listIds(params: GetAllRestQueryParams): Promise<{ ids: string[]; count: number }> {
  const { results, count: total } = await userController.getUsers(request(params));
  return { ids: results.map((user) => user.id), count: total };
}

let admin: RoleEntity;
let agent: RoleEntity;

beforeEach(async () => {
  admin = await saveRole({ name: 'admin' });
  agent = await saveRole({ name: 'agent' });
});

describe('storage', () => {
  it('should store hashed identities and encrypted details, and read the details back decrypted', async () => {
    // Arrange
    const meta = { first_name: 'Dana', last_name: 'Levi', email: 'dana@example.com', phone: '0501234567' };

    // Act
    const created = await userController.createUser(
      request({ identities: ['dana@example.com', '0501234567'], password: PASSWORD, roles: ['admin'], meta })
    );

    // Assert
    const row = await rawUser(created.id);
    expect(row.identities).toEqual([sha256('dana@example.com'), sha256('0501234567')]);
    for (const plain of Object.values(meta)) {
      expect(row.meta).not.toContain(plain);
    }
    expect(JSON.parse(row.meta as string)).toEqual({
      iv: expect.any(String),
      data: expect.any(String),
      tag: expect.any(String),
    });
    expect(await userController.getUser(request({ id: created.id }))).toEqual({
      id: created.id,
      roles: [admin.output()],
      meta,
    });
    expect(await userController.getUser(request({ identity: '0501234567' }))).toMatchObject({ id: created.id });
  });
});

describe('changes', () => {
  it('should update only the fields given', async () => {
    // Arrange
    const user = await saveUser({ identities: ['dana@example.com'], roles: [admin], meta: { first_name: 'Dana' } });

    // Act
    const updated = await userController.updateUser(request({ id: user.id, roles: ['agent'], mfa_enabled: true }));

    // Assert
    expect(updated).toEqual({ id: user.id, roles: [agent.output()], meta: { first_name: 'Dana' } });
    expect(await rawUser(user.id)).toMatchObject({
      mfa_enabled: true,
      is_active: true,
      identities: [sha256('dana@example.com')],
    });
  });

  it('should refuse an identity another user has on create', async () => {
    await saveUser({ identities: ['dana@example.com'], roles: [admin] });

    await expect(
      userController.createUser(request({ identities: ['dana@example.com'], roles: ['agent'] }))
    ).rejects.toThrow('User with identity dana@example.com already exists');
    expect(await count('users')).toBe(1);
  });

  it("should refuse another user's identity on update, and leave the user's row as it was", async () => {
    // Arrange
    await saveUser({ identities: ['noa@example.com'], roles: [admin] });
    const user = await saveUser({
      identities: ['dana@example.com'],
      password: PASSWORD,
      roles: [admin],
      meta: { email: 'dana@example.com' },
    });
    const before = await rawUser(user.id);

    // Act
    const update = userController.updateUser(
      request({ id: user.id, identities: ['noa@example.com'], meta: { email: 'noa@example.com' }, roles: ['agent'] })
    );

    // Assert
    await expect(update).rejects.toThrow('User with identity noa@example.com already exists');
    expect(await rawUser(user.id)).toEqual(before);
    expect((await userController.getUser(request({ id: user.id }))).roles).toEqual([admin.output()]);
  });

  it('should accept an update that repeats an identity the user already has', async () => {
    const user = await saveUser({
      identities: ['dana@example.com'],
      roles: [admin],
      meta: { email: 'dana@example.com' },
    });

    await userController.updateUser(
      request({
        id: user.id,
        identities: ['dana@example.com'],
        meta: { email: 'dana@example.com', phone: '0501234567' },
      })
    );

    expect((await userController.getUser(request({ identity: 'dana@example.com' }))).meta).toEqual({
      email: 'dana@example.com',
      phone: '0501234567',
    });
  });

  it("should remove a deleted user's codes, tokens and role links, and nothing of other users", async () => {
    // Arrange
    const user = await saveUser({
      identities: ['dana@example.com'],
      password: PASSWORD,
      roles: [admin],
      mfa_enabled: true,
    });
    await saveUser({ identities: ['noa@example.com'], roles: [admin] });
    const challenge = await authController.authenticate(request({ identity: 'dana@example.com' }));
    await authController.createToken(request(challenge));
    await authController.authenticate(request({ identity: 'dana@example.com' }));

    // Act
    await userController.deleteUser(request({ id: user.id }));

    // Assert
    expect(await count('users')).toBe(1);
    expect(await count('auth_codes')).toBe(0);
    expect(await count('refresh_tokens')).toBe(0);
    expect(await count('user_roles')).toBe(1);
    expect(await count('roles')).toBe(2);
  });

  it('should see only the users this test saved', async () => {
    await saveUser({ identities: ['isolated@example.com'], roles: [agent] });

    expect((await listIds({})).count).toBe(1);
  });

  it('should also see only its own users', async () => {
    expect((await listIds({})).count).toBe(0);
  });
});

describe('list', () => {
  let dana: UserEntity;
  let anna: UserEntity;
  let dan: UserEntity;

  beforeEach(async () => {
    dana = await saveUser({
      identities: ['dana@example.com'],
      roles: [admin],
      meta: { first_name: 'Dana', last_name: 'Levi', email: 'dana@example.com' },
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
    anna = await saveUser({
      identities: ['anna@example.com'],
      roles: [agent],
      is_active: false,
      meta: { first_name: 'Anna Maria', last_name: 'Cohen', email: 'anna@example.com', phone: '0527654321' },
      created_at: new Date('2026-03-01T00:00:00Z'),
    });
    dan = await saveUser({
      identities: ['dan@example.com'],
      roles: [admin, agent],
      meta: { first_name: 'Dan', last_name: 'Avraham', phone: '0501234567' },
      created_at: new Date('2026-02-01T00:00:00Z'),
    });
  });

  it('should list newest first, one page at a time, with the total count', async () => {
    expect(await listIds({})).toEqual({ ids: [anna.id, dan.id, dana.id], count: 3 });
    expect(await listIds({ page: 2, limit: 2 })).toEqual({ ids: [dana.id], count: 3 });
  });

  it('should sort by a requested column', async () => {
    expect((await listIds({ sort: [{ sort_by: 'created_at', sort_direction: 1 }] })).ids).toEqual([
      dana.id,
      dan.id,
      anna.id,
    ]);
  });

  it('should search names, one word or several', async () => {
    const name = (value: string): GetAllRestQueryParams => ({
      filters: [{ name: 'name', operator: RestFilterFieldOperator.Contains, values: [value] }],
    });

    expect((await listIds(name('dan'))).ids).toEqual([dan.id, dana.id]);
    expect((await listIds(name('Dana Le'))).ids).toEqual([dana.id]);
    expect((await listIds(name('anna maria co'))).ids).toEqual([anna.id]);
  });

  it('should combine a name search with a plain column filter', async () => {
    expect(
      await listIds({
        filters: [
          { name: 'name', operator: RestFilterFieldOperator.Contains, values: ['an'] },
          { name: 'is_active', operator: RestFilterFieldOperator.Equal, values: ['false'] },
        ],
      })
    ).toEqual({ ids: [anna.id], count: 1 });
  });

  it('should filter on email and phone, and paginate the matches', async () => {
    const phone = { name: 'phone', operator: RestFilterFieldOperator.StartsWith, values: ['05'] };

    expect(await listIds({ filters: [phone] })).toEqual({ ids: [anna.id, dan.id], count: 2 });
    expect(await listIds({ filters: [phone], page: 2, limit: 1 })).toEqual({ ids: [dan.id], count: 2 });
    expect(
      (
        await listIds({
          filters: [{ name: 'email', operator: RestFilterFieldOperator.Equal, values: ['DANA@example.com'] }],
        })
      ).ids
    ).toEqual([dana.id]);
  });

  it('should filter on a role name through the join', async () => {
    const { ids } = await listIds({
      filters: [{ name: 'role_name', operator: RestFilterFieldOperator.Equal, values: ['agent'] }],
    });

    expect(ids).toEqual([anna.id, dan.id]);
  });

  it('should find users by a list of ids, and by role names in or out of a list', async () => {
    const byRole = (operator: RestFilterFieldOperator, ...values: string[]): GetAllRestQueryParams => ({
      filters: [{ name: 'role_name', operator, values }],
    });

    expect(
      (await listIds({ filters: [{ name: 'id', operator: RestFilterFieldOperator.In, values: [dana.id, anna.id] }] }))
        .ids
    ).toEqual([anna.id, dana.id]);
    expect((await listIds(byRole(RestFilterFieldOperator.In, 'agent', 'support'))).ids).toEqual([anna.id, dan.id]);
    expect((await listIds(byRole(RestFilterFieldOperator.NotIn, 'agent'))).ids).toEqual([dan.id, dana.id]);
  });

  it('should search the start of a name, an email or a phone', async () => {
    const startsWith = (name: string, value: string): GetAllRestQueryParams => ({
      filters: [{ name, operator: RestFilterFieldOperator.StartsWith, values: [value] }],
    });

    expect((await listIds(startsWith('name', 'Dan'))).ids).toEqual([dan.id, dana.id]);
    expect((await listIds(startsWith('email', 'anna@'))).ids).toEqual([anna.id]);
    expect((await listIds(startsWith('phone', '050'))).ids).toEqual([dan.id]);
  });

  it('should refuse a filter or sort name it does not offer', async () => {
    await expect(
      listIds({ filters: [{ name: 'id = id OR 1=1 --', operator: RestFilterFieldOperator.Equal, values: ['x'] }] })
    ).rejects.toThrow('Unknown filter field id = id OR 1=1 --');
    await expect(
      listIds({ filters: [{ name: 'password', operator: RestFilterFieldOperator.Equal, values: [''] }] })
    ).rejects.toThrow('Unknown filter field password');
    await expect(
      listIds({ sort: [{ sort_by: '(SELECT password FROM users LIMIT 1)', sort_direction: 1 }] })
    ).rejects.toThrow('Unknown sort field (SELECT password FROM users LIMIT 1)');
  });

  // Pinned as found: a limit without a page fails in SQL.
  it('should fail when a limit is given without a page', async () => {
    await expect(listIds({ limit: 2 })).rejects.toThrow('Provided "skip" value is not a number');
  });
});
