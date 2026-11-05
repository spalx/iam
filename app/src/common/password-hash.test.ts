import { createHash, scryptSync } from 'crypto';

import { hashPassword, verifyPassword } from './password-hash';

// The unit test environment's PASSWORD_SALT
const SALT = 'test-password-salt';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function weakScrypt(password: string): string {
  const salt = Buffer.from('0123456789abcdef');
  const hash = scryptSync(password, salt, 32, { N: 2 ** 10, r: 8, p: 1 });
  return `scrypt$10$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

let hashed: string;

beforeAll(async () => {
  hashed = await hashPassword('correct horse battery');
});

describe('hashPassword', () => {
  it('should store scrypt with its settings, a salt of its own and no trace of the password', async () => {
    const again = await hashPassword('correct horse battery');

    expect(hashed).toMatch(/^scrypt\$15\$8\$3\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(again).not.toBe(hashed);
    expect(hashed).not.toContain('correct horse');
  });
});

describe('verifyPassword - scrypt', () => {
  it('should accept the password it was made from, with no upgrade', async () => {
    expect(await verifyPassword('correct horse battery', hashed)).toEqual({ ok: true, needsUpgrade: false });
  });

  it('should refuse another password', async () => {
    expect(await verifyPassword('correct horse batterY', hashed)).toEqual({ ok: false, needsUpgrade: false });
  });

  it('should accept a hash made with weaker settings and ask for an upgrade', async () => {
    const weak = weakScrypt('secret');

    expect(await verifyPassword('secret', weak)).toEqual({ ok: true, needsUpgrade: true });
    expect(await verifyPassword('wrong', weak)).toEqual({ ok: false, needsUpgrade: false });
  });

  it.each([
    'scrypt$15$8$3$c2FsdA',
    'scrypt$x$8$3$c2FsdA$aGFzaA',
    'scrypt$40$8$3$c2FsdA$aGFzaA',
    'scrypt$15$0$3$c2FsdA$aGFzaA',
    'scrypt$15$8$3$$aGFzaA',
  ])('should refuse every password against the malformed value %p', async (stored) => {
    expect(await verifyPassword('secret', stored)).toEqual({ ok: false, needsUpgrade: false });
  });
});

describe('verifyPassword - old SHA-256 hashes', () => {
  it('should accept sha256(password + PASSWORD_SALT) and ask for an upgrade', async () => {
    const stored = sha256('secret' + SALT);

    expect(await verifyPassword('secret', stored)).toEqual({ ok: true, needsUpgrade: true });
    expect(await verifyPassword('wrong', stored)).toEqual({ ok: false, needsUpgrade: false });
    expect(await verifyPassword('secret', sha256('secret'))).toEqual({ ok: false, needsUpgrade: false });
  });

  it('should accept a plain sha256(password) when PASSWORD_SALT is empty', async () => {
    const original = process.env.PASSWORD_SALT;
    process.env.PASSWORD_SALT = '';
    try {
      await jest.isolateModulesAsync(async () => {
        const isolated = await import('./password-hash');

        expect(await isolated.verifyPassword('secret', sha256('secret'))).toEqual({ ok: true, needsUpgrade: true });
        expect(await isolated.verifyPassword('secret', sha256('secret' + SALT))).toEqual({
          ok: false,
          needsUpgrade: false,
        });
      });
    } finally {
      process.env.PASSWORD_SALT = original;
    }
  });

  it('should accept upper-case hex too', async () => {
    expect(await verifyPassword('secret', sha256('secret' + SALT).toUpperCase())).toEqual({
      ok: true,
      needsUpgrade: true,
    });
  });
});

describe('verifyPassword - no usable password', () => {
  it.each(['', 'md5:5ebe2294ecd0e0f08eab7690d2a6ee69', sha256('secret' + SALT).slice(1)])(
    'should refuse every password against %p',
    async (stored) => {
      expect(await verifyPassword('secret', stored)).toEqual({ ok: false, needsUpgrade: false });
      expect(await verifyPassword('', stored)).toEqual({ ok: false, needsUpgrade: false });
    }
  );
});
