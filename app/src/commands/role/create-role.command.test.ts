import roleController from '@/controllers/role.controller';
import CreateRoleCommand from './create-role.command';

jest.mock('@/controllers/role.controller', () => ({
  __esModule: true,
  default: { createRole: jest.fn() },
}));

describe('CreateRoleCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'createRole' };
    jest.mocked(roleController.createRole).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new CreateRoleCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(roleController.createRole).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(roleController.createRole).mockRejectedValueOnce(error);

    await expect(new CreateRoleCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
