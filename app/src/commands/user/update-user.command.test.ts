import userController from '@/controllers/user.controller';
import UpdateUserCommand from './update-user.command';

jest.mock('@/controllers/user.controller', () => ({
  __esModule: true,
  default: { updateUser: jest.fn() },
}));

describe('UpdateUserCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'updateUser' };
    jest.mocked(userController.updateUser).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new UpdateUserCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(userController.updateUser).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(userController.updateUser).mockRejectedValueOnce(error);

    await expect(new UpdateUserCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
