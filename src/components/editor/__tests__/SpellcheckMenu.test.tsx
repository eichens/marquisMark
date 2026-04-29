import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpellcheckMenu } from "../SpellcheckMenu";
import { createMockEditor } from "../../../test/mockEditor";

// These are imported-then-stubbed below. We mock them to avoid dragging the
// whole spellcheck plugin (+ nspell + dictionaries) into the test.
vi.mock("../../../extensions/Spellcheck", () => ({
  triggerRescan: vi.fn(),
}));

vi.mock("../../../services/spellcheck", () => ({
  ignoreWord: vi.fn(),
}));

import { triggerRescan } from "../../../extensions/Spellcheck";
import { ignoreWord } from "../../../services/spellcheck";

function fireContext(detail: {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
  x?: number;
  y?: number;
}) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("spellcheck-context", {
        detail: { x: 50, y: 60, ...detail },
      }),
    );
  });
}

describe("SpellcheckMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing initially", () => {
    const editor = createMockEditor();
    const { container } = render(<SpellcheckMenu editor={editor} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens with suggestions on spellcheck-context event", () => {
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);

    fireContext({
      word: "teh",
      from: 1,
      to: 4,
      suggestions: ["the", "ten"],
    });

    expect(screen.getByRole("button", { name: "the" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ten" })).toBeInTheDocument();
  });

  it("replaces the word when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);

    fireContext({
      word: "teh",
      from: 1,
      to: 4,
      suggestions: ["the"],
    });

    await user.click(screen.getByRole("button", { name: "the" }));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls.map((c) => c[0]);
    expect(calls).toContain("command");
    // Menu hides after replace
    expect(screen.queryByRole("button", { name: "the" })).not.toBeInTheDocument();
  });

  it("shows 'No suggestions' when suggestions array is empty", () => {
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);
    fireContext({ word: "xyz", from: 0, to: 3, suggestions: [] });
    expect(screen.getByText(/no suggestions/i)).toBeInTheDocument();
  });

  it("calls ignoreWord and triggers a rescan on Ignore", async () => {
    const user = userEvent.setup();
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);
    fireContext({ word: "xyz", from: 0, to: 3, suggestions: [] });

    await user.click(screen.getByRole("button", { name: /^ignore$/i }));
    expect(ignoreWord).toHaveBeenCalledWith("xyz");
    expect(triggerRescan).toHaveBeenCalled();
    expect(screen.queryByText(/no suggestions/i)).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);
    fireContext({ word: "xyz", from: 0, to: 3, suggestions: ["x"] });
    expect(screen.getByRole("button", { name: "x" })).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByRole("button", { name: "x" })).not.toBeInTheDocument();
  });

  it("closes on outside mousedown", () => {
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);
    fireContext({ word: "xyz", from: 0, to: 3, suggestions: ["x"] });

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });
    expect(screen.queryByRole("button", { name: "x" })).not.toBeInTheDocument();
  });

  it("closes on scroll", () => {
    const editor = createMockEditor();
    render(<SpellcheckMenu editor={editor} />);
    fireContext({ word: "xyz", from: 0, to: 3, suggestions: ["x"] });

    act(() => {
      document.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(screen.queryByRole("button", { name: "x" })).not.toBeInTheDocument();
  });

  it("portals into document.body, not the editor container", () => {
    const editor = createMockEditor();
    const { container } = render(<SpellcheckMenu editor={editor} />);
    fireContext({ word: "xyz", from: 0, to: 3, suggestions: ["x"] });

    expect(container.querySelector(".spellcheck-menu")).toBeNull();
    expect(document.body.querySelector(".spellcheck-menu")).not.toBeNull();
  });
});
