import authController from '@/controllers/auth.controller';
import CreateTokenCommand from './create-token.command';

jest.mock('@/controllers/auth.controller', () => ({
  __esModule: true,
  default: { createToken: jest.fn() },
}));

describe('CreateTokenCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'createToken' };
    jest.mocked(authController.createToken).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new CreateTokenCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(authController.createToken).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(authController.createToken).mockRejectedValueOnce(error);

    await expect(new CreateTokenCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
