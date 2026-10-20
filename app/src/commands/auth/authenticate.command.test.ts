import authController from '@/controllers/auth.controller';
import AuthenticateCommand from './authenticate.command';

jest.mock('@/controllers/auth.controller', () => ({
  __esModule: true,
  default: { authenticate: jest.fn() },
}));

describe('AuthenticateCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'authenticate' };
    jest.mocked(authController.authenticate).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new AuthenticateCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(authController.authenticate).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(authController.authenticate).mockRejectedValueOnce(error);

    await expect(new AuthenticateCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
