export interface IAppConfig {
  app: {
    port: number;
    host: string;
  };
  auth: {
    jwt_private_key_file_old: string;
    jwt_private_key_file: string;
    jwt_public_key_file_old: string;
    jwt_public_key_file: string;
    access_token_expires_in: number;
    refresh_token_expires_in: number;
    auth_code_expires_in: number;
    auth_code_length: number;
    // Wrong codes a sign-in challenge accepts before it is spent
    auth_code_max_attempts: number;
  };
  user: {
    password_salt: string;
  };
  db: {
    user: string;
    password: string;
    host: string;
    name: string;
    encryption_secret: string;
  };
}
