import { encryptionTransformer } from './encryption.transformer';

interface EncryptedPayload {
  iv: string;
  data: string;
  tag: string;
}

const META = { first_name: 'Dana', last_name: 'Levi', email: 'dana@example.com', phone: '0501234567' };

function encrypt(value: Record<string, unknown> | null): string | null {
  return encryptionTransformer.to(value);
}

// The stored form of a value that isn't null.
function stored(value: Record<string, unknown>): string {
  const result = encrypt(value);
  if (result === null) {
    throw new Error('expected a stored value');
  }
  return result;
}

function decrypt(value: string | null): Record<string, unknown> | null {
  return encryptionTransformer.from(value);
}

// Loads a fresh copy of the transformer, which derives its key from ENCRYPTION_SECRET on import.
async function loadWithSecret(secret: string): Promise<typeof encryptionTransformer> {
  const original = process.env.ENCRYPTION_SECRET;
  process.env.ENCRYPTION_SECRET = secret;
  let transformer: typeof encryptionTransformer | undefined;
  try {
    await jest.isolateModulesAsync(async () => {
      transformer = (await import('./encryption.transformer')).encryptionTransformer;
    });
  } finally {
    process.env.ENCRYPTION_SECRET = original;
  }
  if (!transformer) {
    throw new Error('encryption.transformer did not load');
  }
  return transformer;
}

describe('encryptionTransformer - to', () => {
  it('should store the value as JSON of an IV, the ciphertext and the tag, with no plaintext', () => {
    // Act
    const value = stored(META);

    // Assert
    const payload = JSON.parse(value) as EncryptedPayload;
    expect(Object.keys(payload).sort()).toEqual(['data', 'iv', 'tag']);
    expect(Buffer.from(payload.iv, 'base64')).toHaveLength(16);
    expect(Buffer.from(payload.tag, 'base64')).toHaveLength(16);
    for (const plain of Object.values(META)) {
      expect(value).not.toContain(plain);
    }
  });

  it('should use a fresh IV each time, so the same value encrypts differently', () => {
    const first = JSON.parse(stored(META)) as EncryptedPayload;
    const second = JSON.parse(stored(META)) as EncryptedPayload;

    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
  });

  it.each([null, undefined])('should store %s as null', (value) => {
    expect(encrypt(value as null)).toBeNull();
  });
});

describe('encryptionTransformer - from', () => {
  it('should read back what it stored', () => {
    expect(decrypt(encrypt(META))).toEqual(META);
  });

  it.each([null, ''])('should read %p as null', (value) => {
    expect(decrypt(value)).toBeNull();
  });

  describe('should_read_null_when_the_value_cannot_be_decrypted', () => {
    it('should read a value whose tag was changed as null', () => {
      // Arrange
      const payload = JSON.parse(stored(META)) as EncryptedPayload;
      const tag = Buffer.from(payload.tag, 'base64');
      tag[0] ^= 0xff;

      // Act and Assert
      expect(decrypt(JSON.stringify({ ...payload, tag: tag.toString('base64') }))).toBeNull();
    });

    it('should read a value whose ciphertext was changed as null', () => {
      const payload = JSON.parse(stored(META)) as EncryptedPayload;
      const data = Buffer.from(payload.data, 'base64');
      data[0] ^= 0xff;

      expect(decrypt(JSON.stringify({ ...payload, data: data.toString('base64') }))).toBeNull();
    });

    it('should read a value stored under another secret as null', async () => {
      const other = await loadWithSecret('another-secret');

      expect(decrypt(other.to(META))).toBeNull();
    });

    it('should read a value that is not JSON as null', () => {
      expect(decrypt('plain text')).toBeNull();
    });
  });
});
