import { createHmac, hkdfSync, timingSafeEqual } from 'crypto';

import appConfig from '@/config/app.config';

// A key of its own for sign-in codes, derived from the encryption secret, which is never stored in the database.
// A code is only a few characters: an unkeyed hash of it could be reversed by trying every code.
const key = Buffer.from(hkdfSync('sha256', appConfig.db.encryption_secret, '', 'iam sign-in code', 32));

export function hashAuthCode(challengeId: string, code: string): string {
  return createHmac('sha256', key).update(`${challengeId}:${code}`).digest('base64url');
}

export function authCodeMatches(challengeId: string, code: string, storedHash: string): boolean {
  const expected = Buffer.from(hashAuthCode(challengeId, code));
  const stored = Buffer.from(storedHash);
  return stored.length === expected.length && timingSafeEqual(stored, expected);
}
