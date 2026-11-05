import appDataSource from '@/common/db/app-data-source';
import { saveUser } from '../factories/iam.factory';

async function columns(): Promise<string[]> {
  const rows = await appDataSource.query<{ column_name: string }[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_codes' ORDER BY column_name"
  );
  return rows.map((row) => row.column_name);
}

describe('the migration that hashes sign-in codes', () => {
  it('should drop the readable codes in flight, and its down migration should restore the old columns', async () => {
    // Arrange: back to the schema before the migration, with a readable code in flight
    const user = await saveUser({ identities: ['dana@example.com'] });
    await appDataSource.instance.undoLastMigration();
    expect(await columns()).toContain('mfa_code');
    await appDataSource.query(
      'INSERT INTO auth_codes (user_id, mfa_code, challenge_id, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, 'X7k2Qp', 'abcdef', new Date(Date.now() + 45_000)]
    );

    // Act
    await appDataSource.runMigrations();

    // Assert
    expect(await columns()).toEqual([
      'attempts',
      'challenge_id',
      'code_hash',
      'created_at',
      'expires_at',
      'id',
      'updated_at',
      'user_id',
    ]);
    const [{ count }] = await appDataSource.query<{ count: string }[]>('SELECT COUNT(*) AS count FROM auth_codes');
    expect(Number(count)).toBe(0);
  });
});
