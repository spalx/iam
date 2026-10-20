import userController from '@/controllers/user.controller';
import GetUserCommand from './get-user.command';

jest.mock('@/controllers/user.controller', () => ({
  __esModule: true,
  default: { getUser: jest.fn() },
}));

describe('GetUserCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'getUser' };
    jest.mocked(userController.getUser).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new GetUserCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(userController.getUser).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(userController.getUser).mockRejectedValueOnce(error);

    await expect(new GetUserCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
