import authController from '@/controllers/auth.controller';
import RefreshTokenCommand from './refresh-token.command';

jest.mock('@/controllers/auth.controller', () => ({
  __esModule: true,
  default: { refreshToken: jest.fn() },
}));

describe('RefreshTokenCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'refreshToken' };
    jest.mocked(authController.refreshToken).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new RefreshTokenCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(authController.refreshToken).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(authController.refreshToken).mockRejectedValueOnce(error);

    await expect(new RefreshTokenCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
