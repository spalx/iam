import { relative, isAbsolute } from 'path';

import { TEST_KEY_FILES } from './test-keys';

// Runs before any module loads, because the config files read process.env on import. Values already
// set are kept, so the integration global setup can supply the real database connection.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  // A fixed offset away from UTC, so a test catches IAM's times and the database's being mixed
  TZ: 'Etc/GMT-3',
  PORT: '3030',
  HOST: 'iam',
  DB_HOST: 'localhost',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'iam-test',
  PASSWORD_SALT: 'test-password-salt',
  ENCRYPTION_SECRET: 'test-encryption-secret',
  ACCESS_TOKEN_EXPIRES_IN: '900',
  REFRESH_TOKEN_EXPIRES_IN: '604800',
  AUTH_CODE_EXPIRES_IN: '45',
  AUTH_CODE_LENGTH: '6',
};

for (const [name, value] of Object.entries(TEST_ENV)) {
  process.env[name] ??= value;
}

// The key config reads these files on import. They must be the keys the global setup generated for this run,
// never a path left in the shell, which on a developer machine is the real key.
const keysDir = process.env.TEST_KEYS_DIR;
for (const name of Object.keys(TEST_KEY_FILES)) {
  const file = process.env[name] ?? '';
  const inside = keysDir ? relative(keysDir, file) : '';
  if (!keysDir || !file || inside.startsWith('..') || isAbsolute(inside)) {
    throw new Error(`${name} must point at the signing keys generated for this test run, not "${file}"`);
  }
}
