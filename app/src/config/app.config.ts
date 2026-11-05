import { IAppConfig } from '@/interfaces/app-config.interface';

const DEFAULT_AUTH_CODE_MAX_ATTEMPTS = 5;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const appConfig: IAppConfig = {
  app: {
    port: Number(process.env.PORT),
    host: process.env.HOST || 'iam',
  },
  auth: {
    jwt_private_key_file_old: process.env.JWT_PRIVATE_KEY_FILE_OLD || '',
    jwt_private_key_file: process.env.JWT_PRIVATE_KEY_FILE || '',
    jwt_public_key_file_old: process.env.JWT_PUBLIC_KEY_FILE_OLD || '',
    jwt_public_key_file: process.env.JWT_PUBLIC_KEY_FILE || '',
    access_token_expires_in: Number(process.env.ACCESS_TOKEN_EXPIRES_IN),
    refresh_token_expires_in: Number(process.env.REFRESH_TOKEN_EXPIRES_IN),
    auth_code_expires_in: Number(process.env.AUTH_CODE_EXPIRES_IN),
    auth_code_length: Number(process.env.AUTH_CODE_LENGTH),
    auth_code_max_attempts: positiveInteger(process.env.AUTH_CODE_MAX_ATTEMPTS, DEFAULT_AUTH_CODE_MAX_ATTEMPTS),
  },
  user: {
    password_salt: process.env.PASSWORD_SALT || '',
  },
  db: {
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || '',
    name: process.env.DB_NAME || '',
    encryption_secret: process.env.ENCRYPTION_SECRET || '',
  },
};

export default Object.freeze(appConfig);
