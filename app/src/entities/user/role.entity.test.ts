import RoleEntity from './role.entity';

describe('RoleEntity - output', () => {
  it('should return the id, the name and the permissions only', () => {
    // Arrange
    const role = Object.assign(new RoleEntity(), {
      id: 'role-1',
      name: 'admin',
      permissions: ['users.read', 'users.write'],
      created_at: new Date(),
      users: [],
    });

    // Act and Assert
    expect(role.output()).toEqual({ id: 'role-1', name: 'admin', permissions: ['users.read', 'users.write'] });
  });
});
