import { generateKeyPairSync } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// The signing-key settings the key config reads on import, each mapped to the file this run writes for it.
export const TEST_KEY_FILES: Record<string, string> = {
  JWT_PRIVATE_KEY_FILE_OLD: 'old.pem',
  JWT_PUBLIC_KEY_FILE_OLD: 'old_pub.pem',
  JWT_PRIVATE_KEY_FILE: 'active.pem',
  JWT_PUBLIC_KEY_FILE: 'active_pub.pem',
};

function writeKeyPair(dir: string, privateFile: string, publicFile: string): void {
  // ES256 keys, in the formats the real key files use.
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  writeFileSync(join(dir, privateFile), privateKey.export({ type: 'sec1', format: 'pem' }), { mode: 0o600 });
  writeFileSync(join(dir, publicFile), publicKey.export({ type: 'spki', format: 'pem' }));
}

/**
 * Generates an old and an active signing key pair for this run and points the key settings at them, replacing
 * whatever the shell had, so no test ever reads the real keys.
 */
export function createTestKeys(): void {
  const dir = mkdtempSync(join(tmpdir(), 'iam-test-keys-'));
  writeKeyPair(dir, TEST_KEY_FILES.JWT_PRIVATE_KEY_FILE_OLD, TEST_KEY_FILES.JWT_PUBLIC_KEY_FILE_OLD);
  writeKeyPair(dir, TEST_KEY_FILES.JWT_PRIVATE_KEY_FILE, TEST_KEY_FILES.JWT_PUBLIC_KEY_FILE);

  for (const [name, file] of Object.entries(TEST_KEY_FILES)) {
    process.env[name] = join(dir, file);
  }
  process.env.TEST_KEYS_DIR = dir;
}

export function removeTestKeys(): void {
  const dir = process.env.TEST_KEYS_DIR;
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
  }
}
