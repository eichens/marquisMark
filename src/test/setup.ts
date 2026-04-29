import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { tauri } from "./tauri";

// ProseMirror calls layout APIs that jsdom doesn't implement. Stub them to
// empty values so contenteditable interactions don't throw.
if (typeof document !== "undefined") {
  const doc = document as Document & {
    elementFromPoint?: (x: number, y: number) => Element | null;
  };
  if (typeof doc.elementFromPoint !== "function") {
    doc.elementFromPoint = () => null;
  }
}
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function () {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

afterEach(() => {
  cleanup();
  tauri.reset();
});
