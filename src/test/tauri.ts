import { vi } from "vitest";

/**
 * Programmable Tauri mock. Tests register handlers per command name and the
 * mock `invoke` dispatches to them. Each handler can return a value, a
 * Promise, or throw to simulate a Rust-side error.
 *
 * Usage:
 *   tauri.setHandler("read_file", async ({ path }) => ({ content: "x", path }));
 *   const history = tauri.history("read_file");
 *   tauri.reset();
 */

type Handler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

const handlers = new Map<string, Handler>();
const callLog: { cmd: string; args: Record<string, unknown> }[] = [];

export const tauri = {
  setHandler(cmd: string, handler: Handler) {
    handlers.set(cmd, handler);
  },
  setHandlers(map: Record<string, Handler>) {
    for (const [cmd, handler] of Object.entries(map)) {
      handlers.set(cmd, handler);
    }
  },
  history(cmd?: string) {
    return cmd ? callLog.filter((c) => c.cmd === cmd) : [...callLog];
  },
  reset() {
    handlers.clear();
    callLog.length = 0;
    dialogOpenResult = null;
    dialogSaveResult = null;
    dialogOpenCalls.length = 0;
    dialogSaveCalls.length = 0;
    storeBackend.clear();
    storeHistory.length = 0;
  },
};

let dialogOpenResult: string | string[] | null = null;
let dialogSaveResult: string | null = null;
const dialogOpenCalls: unknown[] = [];
const dialogSaveCalls: unknown[] = [];

export const dialog = {
  setOpenResult(result: string | string[] | null) {
    dialogOpenResult = result;
  },
  setSaveResult(result: string | null) {
    dialogSaveResult = result;
  },
  openCalls() {
    return [...dialogOpenCalls];
  },
  saveCalls() {
    return [...dialogSaveCalls];
  },
};

const storeBackend = new Map<string, unknown>();
const storeHistory: { op: string; key?: string; value?: unknown }[] = [];

export const store = {
  set(key: string, value: unknown) {
    storeBackend.set(key, value);
  },
  get(key: string) {
    return storeBackend.get(key);
  },
  history() {
    return [...storeHistory];
  },
};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    const handler = handlers.get(cmd);
    const resolvedArgs = args ?? {};
    callLog.push({ cmd, args: resolvedArgs });
    if (!handler) {
      throw new Error(`No mock handler registered for Tauri command: ${cmd}`);
    }
    return await handler(resolvedArgs);
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async (opts?: unknown) => {
    dialogOpenCalls.push(opts);
    return dialogOpenResult;
  }),
  save: vi.fn(async (opts?: unknown) => {
    dialogSaveCalls.push(opts);
    return dialogSaveResult;
  }),
}));

class MockStore {
  constructor(_path: string) {}
  async get<T = unknown>(key: string): Promise<T | undefined> {
    storeHistory.push({ op: "get", key });
    return storeBackend.get(key) as T | undefined;
  }
  async set(key: string, value: unknown): Promise<void> {
    storeHistory.push({ op: "set", key, value });
    storeBackend.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    storeHistory.push({ op: "delete", key });
    return storeBackend.delete(key);
  }
  async save(): Promise<void> {
    storeHistory.push({ op: "save" });
  }
}

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async (path: string) => new MockStore(path)),
  LazyStore: MockStore,
  Store: MockStore,
}));
