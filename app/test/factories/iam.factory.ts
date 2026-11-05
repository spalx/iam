import appDataSource from '@/common/db/app-data-source';
import { hashPassword } from '@/common/password-hash';
import { sha256 } from '@/common/utils';
import AuthCodeEntity from '@/entities/auth/auth-code.entity';
import RoleEntity from '@/entities/user/role.entity';
import UserEntity from '@/entities/user/user.entity';

export interface RoleFields {
  name: string;
  permissions?: string[];
}

export interface UserFields {
  identities: string[];
  password?: string;
  // Stored as given, in place of a hash of `password`: for hashes of an older kind
  stored_password?: string;
  is_active?: boolean;
  mfa_enabled?: boolean;
  meta?: Record<string, unknown> | null;
  roles?: RoleEntity[];
  created_at?: Date;
}

export async function saveRole(fields: RoleFields): Promise<RoleEntity> {
  const role = Object.assign(new RoleEntity(), { permissions: [`${fields.name}.all`], ...fields });
  return appDataSource.getRepository(RoleEntity).save(role);
}

// Saves a user the way the service stores one: identities and password hashed, meta encrypted.
export async function saveUser(fields: UserFields): Promise<UserEntity> {
  const user = Object.assign(new UserEntity(), {
    identities: fields.identities.map((identity) => sha256(identity)),
    password: fields.stored_password ?? (fields.password ? await hashPassword(fields.password) : ''),
    is_active: fields.is_active ?? true,
    mfa_enabled: fields.mfa_enabled ?? false,
    meta: fields.meta ?? null,
    roles: fields.roles ?? [],
  });
  const saved = await appDataSource.getRepository(UserEntity).save(user);

  if (fields.created_at) {
    await appDataSource.query('UPDATE users SET created_at = $1 WHERE id = $2', [fields.created_at, saved.id]);
    saved.created_at = fields.created_at;
  }
  return saved;
}

export async function expireAuthCode(challengeId: string): Promise<void> {
  await appDataSource
    .getRepository(AuthCodeEntity)
    .update({ challenge_id: challengeId }, { expires_at: new Date(Date.now() - 1000) });
}
