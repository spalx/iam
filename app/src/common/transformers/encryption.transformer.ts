import { ValueTransformer } from 'typeorm';
import * as crypto from 'crypto';

import appConfig from '@/config/app.config';

const algorithm = 'aes-256-gcm';
const secret = crypto.createHash('sha256').update(appConfig.db.encryption_secret).digest();
const ivLength = 16;

export const encryptionTransformer: ValueTransformer = {
  to(value: Record<string, unknown> | null): string | null {
    if (!value) {
      return null;
    }

    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, secret, iv);

    const json = JSON.stringify(value);
    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');

    return JSON.stringify({
      iv: iv.toString('base64'),
      data: encrypted,
      tag: authTag,
    });
  },

  from(value: string | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    try {
      const payload = JSON.parse(value);
      const iv = Buffer.from(payload.iv, 'base64');
      const encryptedData = payload.data;
      const authTag = Buffer.from(payload.tag, 'base64');

      const decipher = crypto.createDecipheriv(algorithm, secret, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (err) {
      return null;
    }
  },
};
