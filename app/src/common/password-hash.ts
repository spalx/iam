import { createHash, randomBytes, scrypt, ScryptOptions, timingSafeEqual } from 'crypto';

import appConfig from '@/config/app.config';

// scrypt at N = 2^15, r = 8, p = 3: one of OWASP's equivalent minimums, 32 MiB per hash. Stored with each hash, so
// raising them later upgrades every password at its next sign-in.
const CURRENT = { ln: 15, r: 8, p: 3 };
// The most a stored value may ask for, so a bad row can't make one sign-in take the memory of many
const LIMITS = { ln: 17, r: 16, p: 16 };
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PREFIX = 'scrypt';

// The hash used before scrypt: sha256(password + PASSWORD_SALT) in hexadecimal.
const OLD_SHA256 = /^[0-9a-f]{64}$/i;

export interface PasswordCheck {
  ok: boolean;
  // The stored value is an older kind, or made with weaker settings: store a new hash of this password
  needsUpgrade: boolean;
}

interface ScryptHash {
  ln: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

const REFUSED: PasswordCheck = { ok: false, needsUpgrade: false };

function deriveKey(password: string, salt: Buffer, length: number, { ln, r, p }: typeof CURRENT): Promise<Buffer> {
  const options: ScryptOptions = { N: 2 ** ln, r, p, maxmem: 2 * 128 * 2 ** ln * r };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function inRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

function parseScrypt(stored: string): ScryptHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) {
    return null;
  }

  const [ln, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  if (!inRange(ln, LIMITS.ln) || !inRange(r, LIMITS.r) || !inRange(p, LIMITS.p) || !salt.length || !hash.length) {
    return null;
  }

  return { ln, r, p, salt, hash };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(password, salt, HASH_BYTES, CURRENT);
  return [PREFIX, CURRENT.ln, CURRENT.r, CURRENT.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<PasswordCheck> {
  if (OLD_SHA256.test(stored)) {
    const expected = createHash('sha256')
      .update(password + appConfig.user.password_salt)
      .digest();
    const matches = timingSafeEqual(Buffer.from(stored, 'hex'), expected);
    return matches ? { ok: true, needsUpgrade: true } : REFUSED;
  }

  const parsed = parseScrypt(stored);
  if (!parsed) {
    // No password, or a kind this service doesn't know: nothing matches it
    return REFUSED;
  }

  const derived = await deriveKey(password, parsed.salt, parsed.hash.length, parsed);
  if (!timingSafeEqual(derived, parsed.hash)) {
    return REFUSED;
  }

  const weaker = parsed.ln < CURRENT.ln || parsed.r < CURRENT.r || parsed.p < CURRENT.p;
  return { ok: true, needsUpgrade: weaker };
}
