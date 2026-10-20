import roleController from '@/controllers/role.controller';
import DeleteRolesCommand from './delete-roles.command';

jest.mock('@/controllers/role.controller', () => ({
  __esModule: true,
  default: { deleteRoles: jest.fn() },
}));

describe('DeleteRolesCommand', () => {
  it('should hand the request to the controller and resolve with nothing', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    jest.mocked(roleController.deleteRoles).mockResolvedValueOnce(undefined);

    // Act
    const answer = await new DeleteRolesCommand().execute(req as never);

    // Assert
    expect(answer).toBeUndefined();
    expect(roleController.deleteRoles).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(roleController.deleteRoles).mockRejectedValueOnce(error);

    await expect(new DeleteRolesCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
