import { createTestKeys } from './test-keys';

// Runs once before any test worker starts; workers inherit the key settings it sets.
export default function setUpTestKeys(): void {
  createTestKeys();
}
