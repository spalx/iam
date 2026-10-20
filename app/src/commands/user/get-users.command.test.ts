import userController from '@/controllers/user.controller';
import GetUsersCommand from './get-users.command';

jest.mock('@/controllers/user.controller', () => ({
  __esModule: true,
  default: { getUsers: jest.fn() },
}));

describe('GetUsersCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'getUsers' };
    jest.mocked(userController.getUsers).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new GetUsersCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(userController.getUsers).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(userController.getUsers).mockRejectedValueOnce(error);

    await expect(new GetUsersCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
