import { vi } from "vitest";
import type { Editor } from "@tiptap/react";

/**
 * Chainable command stub that records every call. A `run()` at the end
 * returns true to mimic the real API.
 *
 *   const editor = createMockEditor();
 *   // ...interact with component...
 *   expect(editor.__chainCalls).toContainEqual(["toggleBold"]);
 */
export function createChain() {
  const calls: string[][] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === "run") {
        return () => true;
      }
      return (...args: unknown[]) => {
        calls.push([prop, ...args.map((a) => JSON.stringify(a))]);
        return chain;
      };
    },
  };
  const chain = new Proxy({}, handler);
  return { chain, calls };
}

export interface MockEditorOptions {
  active?: Record<string, boolean | ((attrs?: Record<string, unknown>) => boolean)>;
  canUndo?: boolean;
  canRedo?: boolean;
  textStyleColor?: string | null;
}

export function createMockEditor(options: MockEditorOptions = {}) {
  const { chain, calls } = createChain();
  const active = options.active ?? {};
  const editor = {
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({
      undo: () => options.canUndo ?? true,
      redo: () => options.canRedo ?? true,
    })),
    isActive: vi.fn(
      (name: string | Record<string, unknown>, attrs?: Record<string, unknown>) => {
        // editor.isActive({ textAlign: "left" }) form
        if (typeof name === "object") {
          const key = JSON.stringify(name);
          const entry = active[key];
          if (typeof entry === "function") return entry();
          return !!entry;
        }
        const entry = active[name];
        if (typeof entry === "function") return entry(attrs);
        return !!entry;
      },
    ),
    getAttributes: vi.fn((name: string) => {
      if (name === "textStyle") {
        return { color: options.textStyleColor ?? null };
      }
      return {};
    }),
    state: {
      selection: { from: 0, to: 0 },
      doc: {
        textBetween: () => "",
      },
      schema: {
        text: (t: string) => ({ type: "text", text: t }),
      },
    },
    view: {},
    commands: {},
  } as unknown as Editor & { __chainCalls: string[][] };
  (editor as unknown as { __chainCalls: string[][] }).__chainCalls = calls;
  return editor;
}
