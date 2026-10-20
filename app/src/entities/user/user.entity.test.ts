import RoleEntity from './role.entity';
import UserEntity from './user.entity';

function buildRole(name: string): RoleEntity {
  return Object.assign(new RoleEntity(), { id: `role-${name}`, name, permissions: [`${name}.all`] });
}

function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 'user-1',
    identities: ['hashed-identity'],
    password: 'hashed-password',
    roles: [buildRole('admin')],
    meta: { first_name: 'Dana' },
    ...overrides,
  });
}

describe('UserEntity', () => {
  it('should start active, without MFA and without a password', () => {
    const user = new UserEntity();

    expect(user.is_active).toBe(true);
    expect(user.mfa_enabled).toBe(false);
    expect(user.password).toBe('');
  });

  describe('UserEntity - output', () => {
    it('should return the id, each role output and the meta, and never the password or identities', () => {
      // Act
      const output = buildUser().output();

      // Assert
      expect(output).toEqual({
        id: 'user-1',
        roles: [{ id: 'role-admin', name: 'admin', permissions: ['admin.all'] }],
        meta: { first_name: 'Dana' },
      });
    });

    it('should return an empty object for a null meta', () => {
      expect(buildUser({ meta: null }).output().meta).toEqual({});
    });

    it('should leave the roles out when they were not loaded', () => {
      expect(buildUser({ roles: undefined }).output().roles).toBeUndefined();
    });
  });
});
