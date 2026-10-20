import roleController from '@/controllers/role.controller';
import UpdateRoleCommand from './update-role.command';

jest.mock('@/controllers/role.controller', () => ({
  __esModule: true,
  default: { updateRole: jest.fn() },
}));

describe('UpdateRoleCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'updateRole' };
    jest.mocked(roleController.updateRole).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new UpdateRoleCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(roleController.updateRole).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(roleController.updateRole).mockRejectedValueOnce(error);

    await expect(new UpdateRoleCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
