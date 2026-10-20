import { readFileSync } from 'fs';
import { join } from 'path';

import { KeyEntry } from './keys.config';

const KEY_VARIABLES = [
  'JWT_PRIVATE_KEY_FILE_OLD',
  'JWT_PUBLIC_KEY_FILE_OLD',
  'JWT_PRIVATE_KEY_FILE',
  'JWT_PUBLIC_KEY_FILE',
] as const;

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

// Loads a fresh copy of the key config, since it reads the files on import.
async function loadKeys(): Promise<KeyEntry[]> {
  let keys: KeyEntry[] | undefined;
  await jest.isolateModulesAsync(async () => {
    keys = (await import('./keys.config')).keys;
  });
  if (!keys) {
    throw new Error('keys.config did not load');
  }
  return keys;
}

describe('keys', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const name of KEY_VARIABLES) {
      process.env[name] = originalEnv[name];
    }
  });

  it('should read the old and the active key pair from the files the settings name, active last', async () => {
    // Act
    const keys = await loadKeys();

    // Assert
    expect(keys).toEqual([
      {
        kid: 'jwt-key-1',
        privateKey: readFileSync(env('JWT_PRIVATE_KEY_FILE_OLD'), 'utf8'),
        publicKey: readFileSync(env('JWT_PUBLIC_KEY_FILE_OLD'), 'utf8'),
        alg: 'ES256',
      },
      {
        kid: 'jwt-key-2',
        privateKey: readFileSync(env('JWT_PRIVATE_KEY_FILE'), 'utf8'),
        publicKey: readFileSync(env('JWT_PUBLIC_KEY_FILE'), 'utf8'),
        alg: 'ES256',
      },
    ]);
    expect(keys[0].privateKey).not.toBe(keys[1].privateKey);
    expect(keys[1].privateKey).toContain('-----BEGIN EC PRIVATE KEY-----');
    expect(keys[1].publicKey).toContain('-----BEGIN PUBLIC KEY-----');
  });

  it.each(KEY_VARIABLES)('should fail on import when the file %s names is missing', async (name) => {
    // Arrange
    process.env[name] = join(env('TEST_KEYS_DIR'), 'missing.pem');

    // Act and Assert
    await expect(loadKeys()).rejects.toThrow(/ENOENT/);
  });
});
