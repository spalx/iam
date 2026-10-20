import userController from '@/controllers/user.controller';
import DeleteUserCommand from './delete-user.command';

jest.mock('@/controllers/user.controller', () => ({
  __esModule: true,
  default: { deleteUser: jest.fn() },
}));

describe('DeleteUserCommand', () => {
  it('should hand the request to the controller and resolve with nothing', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    jest.mocked(userController.deleteUser).mockResolvedValueOnce(undefined);

    // Act
    const answer = await new DeleteUserCommand().execute(req as never);

    // Assert
    expect(answer).toBeUndefined();
    expect(userController.deleteUser).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(userController.deleteUser).mockRejectedValueOnce(error);

    await expect(new DeleteUserCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
