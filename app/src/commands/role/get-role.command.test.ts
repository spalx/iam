import roleController from '@/controllers/role.controller';
import GetRoleCommand from './get-role.command';

jest.mock('@/controllers/role.controller', () => ({
  __esModule: true,
  default: { getRole: jest.fn() },
}));

describe('GetRoleCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'getRole' };
    jest.mocked(roleController.getRole).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new GetRoleCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(roleController.getRole).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(roleController.getRole).mockRejectedValueOnce(error);

    await expect(new GetRoleCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
