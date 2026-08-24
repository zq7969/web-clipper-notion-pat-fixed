import 'reflect-metadata';
import { vi } from 'vitest';

// Chrome/promise APIs are unavailable in vitest's JSDOM/node environment.
// Provide the smallest possible shim so that module-level side effects in
// chrome-promise / chrome storage wrappers can execute without throwing.
const noopStorageArea = {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  getBytesInUse: vi.fn().mockResolvedValue(0),
};
const chromeShim: any = {
  storage: {
    local: noopStorageArea,
    sync: noopStorageArea,
    managed: noopStorageArea,
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    lastError: undefined,
    sendMessage: vi.fn(),
    getURL: (s: string) => s,
  },
  alarms: { create: vi.fn(), clear: vi.fn(), getAll: vi.fn() },
};
if (typeof globalThis.chrome === 'undefined') {
  vi.stubGlobal('chrome', chromeShim);
  vi.stubGlobal('browser', chromeShim);
}
