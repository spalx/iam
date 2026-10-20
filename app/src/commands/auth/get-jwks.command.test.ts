import authController from '@/controllers/auth.controller';
import GetJWKSCommand from './get-jwks.command';

jest.mock('@/controllers/auth.controller', () => ({
  __esModule: true,
  default: { getJWKS: jest.fn() },
}));

describe('GetJWKSCommand', () => {
  it('should hand the request to the controller and return its result', async () => {
    // Arrange
    const req = { id: 'c0ffee00-0000-4000-8000-000000000001', data: { id: 'target-1' } };
    const result = { answer: 'getJWKS' };
    jest.mocked(authController.getJWKS).mockResolvedValueOnce(result as never);

    // Act
    const answer = await new GetJWKSCommand().execute(req as never);

    // Assert
    expect(answer).toBe(result);
    expect(authController.getJWKS).toHaveBeenCalledWith(req);
  });

  it('should pass a controller error through', async () => {
    const error = new Error('Not found');
    jest.mocked(authController.getJWKS).mockRejectedValueOnce(error);

    await expect(new GetJWKSCommand().execute({ data: {} } as never)).rejects.toBe(error);
  });
});
