import userController from '@/controllers/user.controller';
import CreateUserCommand from './create-user.command';

jest.mock('@/controllers/user.controller', () => ({
  __esModule: true,
  default: { createUser: jest.fn() },
}));

describe('CreateUserCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'createUser' };
    jest.mocked(userController.createUser).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new CreateUserCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(userController.createUser).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(userController.createUser).mockRejectedValueOnce(error);

    await expect(new CreateUserCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
