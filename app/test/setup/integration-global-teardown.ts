import { removeTestKeys } from './test-keys';

export default async function stopTestDatabase(): Promise<void> {
  removeTestKeys();
  await globalThis.__POSTGRES_CONTAINER__?.stop();
}
