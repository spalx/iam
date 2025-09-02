import { IAppConfig } from '@/interfaces/app-config.interface';

const appConfig: IAppConfig = {
  app: {
    port: Number(process.env.PORT),
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
