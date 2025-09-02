import fs from 'fs';
import { JWT_KEY_ALGORITHM } from 'iam-pkg';

import appConfig from '@/config/app.config';

export interface KeyEntry {
  kid: string;
  privateKey: string;
  publicKey: string;
  alg: string;
}

export const keys: KeyEntry[] = [
  {
    kid: 'jwt-key-1',
    privateKey: fs.readFileSync(appConfig.auth.jwt_private_key_file_old, 'utf8'),
    publicKey: fs.readFileSync(appConfig.auth.jwt_public_key_file_old, 'utf8'),
    alg: JWT_KEY_ALGORITHM,
  },
  {
    kid: 'jwt-key-2', // Active key
    privateKey: fs.readFileSync(appConfig.auth.jwt_private_key_file, 'utf8'),
    publicKey: fs.readFileSync(appConfig.auth.jwt_public_key_file, 'utf8'),
    alg: JWT_KEY_ALGORITHM,
  },
];
