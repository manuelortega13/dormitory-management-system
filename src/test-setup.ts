/**
 * Global test setup.
 *
 * The unit-test environment supplies `localStorage` / `sessionStorage` as bare
 * objects with no Storage methods, so any code touching them (e.g. AuthService
 * reading the JWT) throws "localStorage.getItem is not a function". Install a
 * working in-memory Storage and clear it between tests so specs stay isolated.
 */
import { beforeEach } from 'vitest';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function install(name: 'localStorage' | 'sessionStorage'): Storage {
  const storage = new MemoryStorage();
  for (const target of [globalThis, globalThis.window].filter(Boolean)) {
    Object.defineProperty(target, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
  return storage;
}

const local = install('localStorage');
const session = install('sessionStorage');

beforeEach(() => {
  local.clear();
  session.clear();
});
