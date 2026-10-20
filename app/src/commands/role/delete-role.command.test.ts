import roleController from '@/controllers/role.controller';
import DeleteRoleCommand from './delete-role.command';

jest.mock('@/controllers/role.controller', () => ({
  __esModule: true,
  default: { deleteRole: jest.fn() },
}));

describe('DeleteRoleCommand', () => {
  it('should hand the request to the controller and resolve with nothing', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    jest.mocked(roleController.deleteRole).mockResolvedValueOnce(undefined);

    // Act
    const answer = await new DeleteRoleCommand().execute(req as never);

    // Assert
    expect(answer).toBeUndefined();
    expect(roleController.deleteRole).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(roleController.deleteRole).mockRejectedValueOnce(error);

    await expect(new DeleteRoleCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
