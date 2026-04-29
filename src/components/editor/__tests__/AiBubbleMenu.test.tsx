import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

// BubbleMenu wraps its children in a Tippy portal that's hard to test. For our
// purposes the menu's visibility is driven by `shouldShow`; we just render the
// children inline so we can exercise the inner UI.
vi.mock("@tiptap/react", async () => {
  const actual = await vi.importActual<typeof import("@tiptap/react")>(
    "@tiptap/react",
  );
  return {
    ...actual,
    BubbleMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

import { AiBubbleMenu } from "../AiBubbleMenu";
import { createMockEditor } from "../../../test/mockEditor";
import { tauri } from "../../../test/tauri";

function makeEditor(selectedText = "hello world") {
  const editor = createMockEditor();
  // State is read-only on the real Editor type; swap it wholesale via any.
  (editor as unknown as { state: unknown }).state = {
    selection: { from: 0, to: selectedText.length },
    doc: {
      textBetween: () => selectedText,
    },
    schema: {
      text: (t: string) => ({ type: "text", text: t }),
    },
  };
  return editor;
}

describe("AiBubbleMenu", () => {
  beforeEach(() => {
    tauri.reset();
  });

  it("renders the predefined actions", () => {
    render(<AiBubbleMenu editor={makeEditor()} />);
    expect(
      screen.getByRole("button", { name: /improve writing/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fix grammar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /make shorter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /custom prompt/i })).toBeInTheDocument();
  });

  it("invokes ai_generate with the selected text and applies the result", async () => {
    const user = userEvent.setup();
    tauri.setHandler("ai_generate", async ({ instruction, selectedText }) => {
      expect(instruction).toMatch(/clarity/i);
      expect(selectedText).toBe("hello world");
      return { text: "improved" };
    });

    const editor = makeEditor();
    render(<AiBubbleMenu editor={editor} />);
    await user.click(screen.getByRole("button", { name: /improve writing/i }));

    // Wait for the async command handler to settle.
    await new Promise((r) => setTimeout(r, 0));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls.map((c) => c[0]);
    expect(calls).toContain("command");
    expect(tauri.history("ai_generate")).toHaveLength(1);
  });

  it("does nothing if the selection is empty", async () => {
    const user = userEvent.setup();
    const editor = makeEditor("   ");
    render(<AiBubbleMenu editor={editor} />);

    await user.click(screen.getByRole("button", { name: /improve writing/i }));
    expect(tauri.history("ai_generate")).toHaveLength(0);
  });

  it("opens the custom prompt input and submits on Enter", async () => {
    const user = userEvent.setup();
    tauri.setHandler("ai_generate", async ({ instruction }) => {
      expect(instruction).toBe("translate to French");
      return { text: "bonjour" };
    });

    render(<AiBubbleMenu editor={makeEditor()} />);
    await user.click(screen.getByRole("button", { name: /custom prompt/i }));
    const input = screen.getByPlaceholderText(/tell ai what to do/i);
    await user.type(input, "translate to French{Enter}");

    await new Promise((r) => setTimeout(r, 0));
    expect(tauri.history("ai_generate")).toHaveLength(1);
  });

  it("surfaces an error and lets the user dismiss it", async () => {
    const user = userEvent.setup();
    tauri.setHandler("ai_generate", async () => {
      throw new Error("bedrock down");
    });

    render(<AiBubbleMenu editor={makeEditor()} />);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: /improve writing/i }));

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/bedrock down/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/bedrock down/i)).not.toBeInTheDocument();
  });

  it("closes the custom prompt input on Escape", async () => {
    const user = userEvent.setup();
    render(<AiBubbleMenu editor={makeEditor()} />);

    await user.click(screen.getByRole("button", { name: /custom prompt/i }));
    const input = screen.getByPlaceholderText(/tell ai what to do/i);
    await user.type(input, "hi{Escape}");

    expect(
      screen.queryByPlaceholderText(/tell ai what to do/i),
    ).not.toBeInTheDocument();
  });
});
