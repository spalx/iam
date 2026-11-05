import { authCodeMatches, hashAuthCode } from './auth-code-hash';

const CHALLENGE = 'Yq3w9m1Zb7Lh0sXc2VtR8nKp4JdFe6Ga5UiOy-_AAAA';

async function withSecret<T>(secret: string, run: (module: typeof import('./auth-code-hash')) => T): Promise<T> {
  const original = process.env.ENCRYPTION_SECRET;
  process.env.ENCRYPTION_SECRET = secret;
  try {
    let result: T | undefined;
    await jest.isolateModulesAsync(async () => {
      result = run(await import('./auth-code-hash'));
    });
    return result as T;
  } finally {
    process.env.ENCRYPTION_SECRET = original;
  }
}

describe('hashAuthCode', () => {
  it('should give the same hash for the same challenge and code, and never contain the code', () => {
    const hash = hashAuthCode(CHALLENGE, 'X7k2Qp');

    expect(hashAuthCode(CHALLENGE, 'X7k2Qp')).toBe(hash);
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).not.toContain('X7k2Qp');
  });

  it('should give another hash for another code or another challenge', () => {
    const hash = hashAuthCode(CHALLENGE, 'X7k2Qp');

    expect(hashAuthCode(CHALLENGE, 'X7k2Qq')).not.toBe(hash);
    expect(hashAuthCode(`${CHALLENGE}x`, 'X7k2Qp')).not.toBe(hash);
  });

  it('should not be a plain hash anyone can recompute without the secret', async () => {
    const one = await withSecret('first-secret', (module) => module.hashAuthCode(CHALLENGE, 'X7k2Qp'));
    const other = await withSecret('second-secret', (module) => module.hashAuthCode(CHALLENGE, 'X7k2Qp'));

    expect(one).not.toBe(other);
  });
});

describe('authCodeMatches', () => {
  it('should accept the code the hash was made from, and refuse any other', () => {
    const hash = hashAuthCode(CHALLENGE, 'X7k2Qp');

    expect(authCodeMatches(CHALLENGE, 'X7k2Qp', hash)).toBe(true);
    expect(authCodeMatches(CHALLENGE, 'x7k2Qp', hash)).toBe(false);
    expect(authCodeMatches('another-challenge', 'X7k2Qp', hash)).toBe(false);
  });

  it('should refuse a stored value of another length without throwing', () => {
    expect(authCodeMatches(CHALLENGE, 'X7k2Qp', 'short')).toBe(false);
    expect(authCodeMatches(CHALLENGE, 'X7k2Qp', '')).toBe(false);
  });
});
