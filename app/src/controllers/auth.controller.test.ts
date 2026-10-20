import authService from '@/services/auth.service';
import authController from './auth.controller';

// A request the DTO schema refuses.
const INVALID = { name: 'ZodError' };

jest.mock('@/services/auth.service', () => ({
  __esModule: true,
  default: {
    getJWKS: jest.fn(),
    authenticate: jest.fn(),
    createToken: jest.fn(),
    createMFAToken: jest.fn(),
    refreshToken: jest.fn(),
    revokeToken: jest.fn(),
  },
}));

const TOKENS = { access_token: 'access', refresh_token: 'refresh' };

function request<T>(data: T): never {
  return { id: 'c0ffee00-0000-4000-8000-000000000001', data } as never;
}

describe('AuthController - getJWKS', () => {
  it('should wrap the service keys in a keys field', async () => {
    const keys = [{ kid: 'jwt-key-2' }];
    jest.mocked(authService.getJWKS).mockResolvedValueOnce(keys as never);

    await expect(authController.getJWKS(request({}))).resolves.toEqual({ keys });
  });
});

describe('AuthController - authenticate', () => {
  it('should hand a valid request to the service and return its challenge', async () => {
    // Arrange
    const data = { identity: 'dana@example.com', password: 'secret' };
    const challenge = { challenge_id: 'abc123', mfa_code: '654321' };
    jest.mocked(authService.authenticate).mockResolvedValueOnce(challenge);

    // Act
    const result = await authController.authenticate(request(data));

    // Assert
    expect(result).toBe(challenge);
    expect(authService.authenticate).toHaveBeenCalledWith(data);
  });

  it.each([{}, { identity: '' }, { identity: 'dana@example.com', password: 7 }])(
    'should refuse %p before calling the service',
    async (data) => {
      await expect(authController.authenticate(request(data))).rejects.toMatchObject(INVALID);
      expect(authService.authenticate).not.toHaveBeenCalled();
    }
  );
});

describe('AuthController - createToken', () => {
  describe('should_take_the_password_path_when_the_request_has_no_mfa_code_and_challenge', () => {
    it('should create a token from the identity and password', async () => {
      // Arrange
      const data = { identity: 'dana@example.com', password: 'secret', fingerprints: ['browser'] };
      jest.mocked(authService.createToken).mockResolvedValueOnce(TOKENS);

      // Act
      const result = await authController.createToken(request(data));

      // Assert
      expect(result).toBe(TOKENS);
      expect(authService.createToken).toHaveBeenCalledWith(data);
      expect(authService.createMFAToken).not.toHaveBeenCalled();
    });

    it.each([{ challenge_id: 'abc123' }, { mfa_code: '654321' }])(
      'should take the password path when only %p is given',
      async (extra) => {
        const data = { identity: 'dana@example.com', password: 'secret', ...extra };
        jest.mocked(authService.createToken).mockResolvedValueOnce(TOKENS);

        await expect(authController.createToken(request(data))).resolves.toBe(TOKENS);
        expect(authService.createToken).toHaveBeenCalledWith(data);
        expect(authService.createMFAToken).not.toHaveBeenCalled();
      }
    );

    it('should refuse a password request without an identity', async () => {
      await expect(authController.createToken(request({ challenge_id: 'abc123' }))).rejects.toMatchObject(INVALID);
      expect(authService.createToken).not.toHaveBeenCalled();
    });
  });

  describe('should_take_the_mfa_path_when_the_request_has_both_a_challenge_and_a_code', () => {
    it('should create a token from the challenge and the code', async () => {
      const data = { challenge_id: 'abc123', mfa_code: '654321' };
      jest.mocked(authService.createMFAToken).mockResolvedValueOnce(TOKENS);

      const result = await authController.createToken(request(data));

      expect(result).toBe(TOKENS);
      expect(authService.createMFAToken).toHaveBeenCalledWith(data);
      expect(authService.createToken).not.toHaveBeenCalled();
    });

    it('should refuse an empty code before calling the service', async () => {
      await expect(authController.createToken(request({ challenge_id: 'abc123', mfa_code: '' }))).rejects.toMatchObject(
        INVALID
      );
      expect(authService.createMFAToken).not.toHaveBeenCalled();
    });
  });
});

describe('AuthController - refreshToken', () => {
  it('should hand a valid request to the service and return the new tokens', async () => {
    const data = { refresh_token: 'refresh', fingerprints: ['browser'] };
    jest.mocked(authService.refreshToken).mockResolvedValueOnce(TOKENS);

    await expect(authController.refreshToken(request(data))).resolves.toBe(TOKENS);
    expect(authService.refreshToken).toHaveBeenCalledWith(data);
  });

  it('should refuse a request without a token before calling the service', async () => {
    await expect(authController.refreshToken(request({ refresh_token: '' }))).rejects.toMatchObject(INVALID);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });
});

describe('AuthController - revokeToken', () => {
  it('should hand a valid request to the service and resolve with nothing', async () => {
    const data = { refresh_token: 'refresh' };
    jest.mocked(authService.revokeToken).mockResolvedValueOnce(undefined);

    await expect(authController.revokeToken(request(data))).resolves.toBeUndefined();
    expect(authService.revokeToken).toHaveBeenCalledWith(data);
  });

  it('should refuse a request without a token before calling the service', async () => {
    await expect(authController.revokeToken(request({}))).rejects.toMatchObject(INVALID);
    expect(authService.revokeToken).not.toHaveBeenCalled();
  });
});
