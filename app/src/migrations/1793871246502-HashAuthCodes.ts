import { MigrationInterface, QueryRunner } from 'typeorm';

export class HashAuthCodes1793871246502 implements MigrationInterface {
  name = 'HashAuthCodes1793871246502';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Codes in flight are stored readable and live seconds: drop them rather than carry them over
    await queryRunner.query(`DELETE FROM "auth_codes"`);
    await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "mfa_code"`);
    await queryRunner.query(`ALTER TABLE "auth_codes" ADD "code_hash" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "auth_codes" ADD "attempts" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_auth_codes_challenge_id" ON "auth_codes" ("challenge_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_auth_codes_expires_at" ON "auth_codes" ("expires_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "auth_codes"`);
    await queryRunner.query(`DROP INDEX "IDX_auth_codes_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_auth_codes_challenge_id"`);
    await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "attempts"`);
    await queryRunner.query(`ALTER TABLE "auth_codes" DROP COLUMN "code_hash"`);
    await queryRunner.query(`ALTER TABLE "auth_codes" ADD "mfa_code" character varying NOT NULL`);
  }
}
