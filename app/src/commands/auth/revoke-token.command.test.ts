import authController from '@/controllers/auth.controller';
import RevokeTokenCommand from './revoke-token.command';

jest.mock('@/controllers/auth.controller', () => ({
  __esModule: true,
  default: { revokeToken: jest.fn() },
}));

describe('RevokeTokenCommand', () => {
  it('should hand the request to the controller and resolve with nothing', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    jest.mocked(authController.revokeToken).mockResolvedValueOnce(undefined);

    // Act
    const answer = await new RevokeTokenCommand().execute(req as never);

    // Assert
    expect(answer).toBeUndefined();
    expect(authController.revokeToken).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(authController.revokeToken).mockRejectedValueOnce(error);

    await expect(new RevokeTokenCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
