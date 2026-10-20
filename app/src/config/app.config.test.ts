import { IAppConfig } from '@/interfaces/app-config.interface';

const CONFIG_VARIABLES = [
  'PORT',
  'HOST',
  'JWT_PRIVATE_KEY_FILE_OLD',
  'JWT_PRIVATE_KEY_FILE',
  'JWT_PUBLIC_KEY_FILE_OLD',
  'JWT_PUBLIC_KEY_FILE',
  'ACCESS_TOKEN_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN',
  'AUTH_CODE_EXPIRES_IN',
  'AUTH_CODE_LENGTH',
  'PASSWORD_SALT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_NAME',
  'ENCRYPTION_SECRET',
] as const;

type ConfigEnv = Partial<Record<(typeof CONFIG_VARIABLES)[number], string>>;

function setConfigEnv(env: ConfigEnv): void {
  for (const name of CONFIG_VARIABLES) {
    Reflect.deleteProperty(process.env, name);
  }
  Object.assign(process.env, env);
}

// Loads a fresh copy of the config with exactly these variables set, since it reads process.env on import.
async function loadConfig(env: ConfigEnv): Promise<IAppConfig> {
  setConfigEnv(env);

  let config: IAppConfig | undefined;
  await jest.isolateModulesAsync(async () => {
    config = (await import('./app.config')).default;
  });
  if (!config) {
    throw new Error('app.config did not load');
  }
  return config;
}

describe('appConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    setConfigEnv(originalEnv);
  });

  describe('should_read_every_value_from_the_environment_when_it_is_set', () => {
    it('should take each value from its variable, with numbers converted', async () => {
      // Arrange
      const env: ConfigEnv = {
        PORT: '4030',
        HOST: 'identity',
        JWT_PRIVATE_KEY_FILE_OLD: 'k/old.pem',
        JWT_PRIVATE_KEY_FILE: 'k/new.pem',
        JWT_PUBLIC_KEY_FILE_OLD: 'k/old_pub.pem',
        JWT_PUBLIC_KEY_FILE: 'k/new_pub.pem',
        ACCESS_TOKEN_EXPIRES_IN: '60',
        REFRESH_TOKEN_EXPIRES_IN: '3600',
        AUTH_CODE_EXPIRES_IN: '30',
        AUTH_CODE_LENGTH: '8',
        PASSWORD_SALT: 'salt',
        DB_USER: 'identity-user',
        DB_PASSWORD: 'identity-secret',
        DB_HOST: 'identity-db',
        DB_NAME: 'identity',
        ENCRYPTION_SECRET: 'secret',
      };

      // Act
      const config = await loadConfig(env);

      // Assert
      expect(config).toEqual({
        app: { port: 4030, host: 'identity' },
        auth: {
          jwt_private_key_file_old: 'k/old.pem',
          jwt_private_key_file: 'k/new.pem',
          jwt_public_key_file_old: 'k/old_pub.pem',
          jwt_public_key_file: 'k/new_pub.pem',
          access_token_expires_in: 60,
          refresh_token_expires_in: 3600,
          auth_code_expires_in: 30,
          auth_code_length: 8,
        },
        user: { password_salt: 'salt' },
        db: {
          user: 'identity-user',
          password: 'identity-secret',
          host: 'identity-db',
          name: 'identity',
          encryption_secret: 'secret',
        },
      });
    });
  });

  describe('should_fall_back_to_the_defaults_when_values_are_not_set', () => {
    it('should use the default host and empty strings when unset', async () => {
      const config = await loadConfig({});

      expect(config.app.host).toBe('iam');
      expect(config.auth).toMatchObject({
        jwt_private_key_file_old: '',
        jwt_private_key_file: '',
        jwt_public_key_file_old: '',
        jwt_public_key_file: '',
      });
      expect(config.user.password_salt).toBe('');
      expect(config.db).toEqual({ user: '', password: '', host: '', name: '', encryption_secret: '' });
    });

    it('should use the default host when the variable is empty', async () => {
      const config = await loadConfig({ HOST: '' });

      expect(config.app.host).toBe('iam');
    });

    it('should have no default for the port or the token settings', async () => {
      const config = await loadConfig({});

      expect(config.app.port).toBeNaN();
      expect(config.auth.access_token_expires_in).toBeNaN();
      expect(config.auth.refresh_token_expires_in).toBeNaN();
      expect(config.auth.auth_code_expires_in).toBeNaN();
      expect(config.auth.auth_code_length).toBeNaN();
    });
  });

  it('should be frozen', async () => {
    const config = await loadConfig({});

    expect(Object.isFrozen(config)).toBe(true);
  });
});
