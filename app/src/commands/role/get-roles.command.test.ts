import roleController from '@/controllers/role.controller';
import GetRolesCommand from './get-roles.command';

jest.mock('@/controllers/role.controller', () => ({
  __esModule: true,
  default: { getRoles: jest.fn() },
}));

describe('GetRolesCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'getRoles' };
    jest.mocked(roleController.getRoles).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new GetRolesCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(roleController.getRoles).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(roleController.getRoles).mockRejectedValueOnce(error);

    await expect(new GetRolesCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
