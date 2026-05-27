import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

// AiBubbleMenu pulls in TipTap's BubbleMenu + Tippy, which are fiddly in jsdom.
// Replace them with simple inline children so they don't explode on mount.
vi.mock("@tiptap/react", async () => {
  const actual = await vi.importActual<typeof import("@tiptap/react")>(
    "@tiptap/react",
  );
  return {
    ...actual,
    BubbleMenu: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

// The spellcheck extension loads nspell + a full dictionary at import time, too
// heavy and unrelated to the flows we're testing here.
vi.mock("../../../extensions/Spellcheck", () => ({
  Spellcheck: { name: "spellcheck-stub", configure: () => ({}) },
  triggerRescan: vi.fn(),
}));
vi.mock("../../../services/spellcheck", () => ({
  ignoreWord: vi.fn(),
  isCorrect: () => true,
  autoCorrection: () => null,
  suggest: () => [],
  skipAutoCorrect: vi.fn(),
}));

import { Editor, type EditorHandle } from "../Editor";
import { tauri, dialog } from "../../../test/tauri";
import { ErrorProvider } from "../../../contexts/ErrorContext";
import { ConfirmDialog } from "../../errors/ConfirmDialog";

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <ErrorProvider>
      {children}
      <ConfirmDialog />
    </ErrorProvider>
  );
}

function renderEditor(overrides: Partial<Parameters<typeof Editor>[0]> = {}) {
  const ref = createRef<EditorHandle>();
  const onExternalFileConsumed = vi.fn();
  const onToggleSidebar = vi.fn();
  const onOpenErrorLog = vi.fn();
  const utils = render(
    <Harness>
      <Editor
        ref={ref}
        sidebarOpen={false}
        onToggleSidebar={onToggleSidebar}
        externalFilePath={null}
        onExternalFileConsumed={onExternalFileConsumed}
        onOpenErrorLog={onOpenErrorLog}
        {...overrides}
      />
    </Harness>,
  );
  const rerender = (ui: React.ReactElement) => utils.rerender(<Harness>{ui}</Harness>);
  return {
    ...utils,
    rerender,
    ref,
    onExternalFileConsumed,
    onToggleSidebar,
    onOpenErrorLog,
  };
}

describe("Editor", () => {
  beforeEach(() => {
    tauri.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the toolbar, status bar, and starts clean", async () => {
    renderEditor();
    // Toolbar (hamburger is shown because sidebar is closed)
    expect(
      await screen.findByRole("button", { name: /toggle sidebar/i }),
    ).toBeInTheDocument();
    // Status bar: Untitled, no dirty marker, 0 words/chars
    expect(screen.getByText(/^untitled$/i)).toBeInTheDocument();
    expect(screen.getByText(/0 words/i)).toBeInTheDocument();
    expect(screen.getByText(/0 characters/i)).toBeInTheDocument();
  });

  it("loads an externally-provided file and shows its basename", async () => {
    tauri.setHandler("read_file", async ({ path }) => ({
      content: "# hello\n",
      path,
    }));

    const { onExternalFileConsumed, rerender } = renderEditor();
    rerender(
      <Editor
        sidebarOpen={false}
        onToggleSidebar={() => {}}
        externalFilePath="/tmp/doc.md"
        onExternalFileConsumed={onExternalFileConsumed}
        onOpenErrorLog={() => {}}
      />,
    );

    await waitFor(() => {
      expect(onExternalFileConsumed).toHaveBeenCalled();
    });
    expect(await screen.findByText(/^doc\.md$/)).toBeInTheDocument();
  });

  it("saves to a new path via the save dialog when no current file", async () => {
    const user = userEvent.setup();
    let written: { path?: string; content?: string } = {};
    tauri.setHandler("write_file", async ({ path, content }) => {
      written = { path: path as string, content: content as string };
    });
    tauri.setHandler("path_exists", async () => false);
    dialog.setSaveResult("/tmp/new.md");

    renderEditor();
    await screen.findByRole("button", { name: /save file/i });
    await user.click(screen.getByRole("button", { name: /save file/i }));

    await waitFor(() => {
      expect(written.path).toBe("/tmp/new.md");
    });
    expect(await screen.findByText(/^new\.md$/)).toBeInTheDocument();
  });

  it("open: loads the selected file and clears the dirty marker", async () => {
    const user = userEvent.setup();
    tauri.setHandler("read_file", async ({ path }) => ({
      content: "contents",
      path,
    }));
    dialog.setOpenResult("/tmp/open.md");

    renderEditor();
    await user.click(
      await screen.findByRole("button", { name: /open file/i }),
    );
    expect(await screen.findByText(/^open\.md$/)).toBeInTheDocument();
  });

  it("prompts before discarding unsaved changes when opening", async () => {
    const user = userEvent.setup();
    // Get into a dirty state by loading an external file, then editing it.
    tauri.setHandler("read_file", async ({ path }) => ({
      content: "# seed",
      path,
    }));
    dialog.setOpenResult("/tmp/should-not-open.md");

    const { rerender } = renderEditor();
    rerender(
      <Editor
        sidebarOpen={false}
        onToggleSidebar={() => {}}
        externalFilePath="/tmp/first.md"
        onExternalFileConsumed={() => {}}
        onOpenErrorLog={() => {}}
      />,
    );
    await screen.findByText(/^first\.md$/);

    // Mark dirty by mutating the contenteditable DOM and firing input.
    // user.click/type triggers layout APIs jsdom doesn't implement.
    const editable = document.querySelector(
      ".ProseMirror",
    ) as HTMLElement | null;
    expect(editable).not.toBeNull();
    act(() => {
      editable!.innerHTML = "<p>seed edited</p>";
      fireEvent.input(editable!);
    });
    await waitFor(() => {
      expect(screen.getByText(/first\.md ?•/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /open file/i }));
    // Click Cancel on the in-app confirm dialog.
    const cancel = await screen.findByRole("button", { name: /^cancel$/i });
    await user.click(cancel);
    // Still showing the original file (dirty marker " •" appended).
    expect(screen.getByText(/first\.md/)).toBeInTheDocument();
    expect(screen.queryByText(/should-not-open/)).not.toBeInTheDocument();
  });

  it("counts tokens and transitions from stale to fresh", async () => {
    const user = userEvent.setup();
    tauri.setHandler("count_tokens", async () => ({ input_tokens: 42 }));
    tauri.setHandler("read_file", async ({ path }) => ({
      content: "words go here",
      path,
    }));

    const { rerender } = renderEditor();
    rerender(
      <Editor
        sidebarOpen={false}
        onToggleSidebar={() => {}}
        externalFilePath="/tmp/t.md"
        onExternalFileConsumed={() => {}}
        onOpenErrorLog={() => {}}
      />,
    );
    await screen.findByText(/^t\.md$/);

    await user.click(screen.getByRole("button", { name: /count tokens/i }));
    expect(await screen.findByText(/42 tokens/)).toBeInTheDocument();
  });

  it("triggers save via ⌘S shortcut", async () => {
    const saved = vi.fn();
    tauri.setHandler("write_file", async (args) => {
      saved(args);
    });
    tauri.setHandler("path_exists", async () => false);
    dialog.setSaveResult("/tmp/short.md");

    renderEditor();
    await screen.findByRole("button", { name: /save file/i });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "s", metaKey: true }),
      );
    });

    await waitFor(() => {
      expect(saved).toHaveBeenCalled();
    });
  });

  it("toggles sidebar via ⌘0 shortcut", async () => {
    const { onToggleSidebar } = renderEditor();
    await screen.findByRole("button", { name: /toggle sidebar/i });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "0", metaKey: true }),
      );
    });
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("saveIfDirty returns true without saving when doc is clean", async () => {
    const { ref } = renderEditor();
    // Wait for editor init.
    await screen.findByRole("button", { name: /save file/i });
    const result = await ref.current!.saveIfDirty();
    expect(result).toBe(true);
    expect(tauri.history("write_file")).toHaveLength(0);
  });

  it("copy-to-clipboard button triggers clipboard write", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    tauri.setHandler("read_file", async ({ path }) => ({
      content: "# hi\n",
      path,
    }));

    const { rerender } = renderEditor();
    rerender(
      <Editor
        sidebarOpen={false}
        onToggleSidebar={() => {}}
        externalFilePath="/tmp/c.md"
        onExternalFileConsumed={() => {}}
        onOpenErrorLog={() => {}}
      />,
    );
    await screen.findByText(/^c\.md$/);

    await user.click(screen.getByRole("button", { name: /copy as markdown/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText.mock.calls[0][0]).toMatch(/hi/);
  });

  it("offers a save-as retry when the known file path no longer exists", async () => {
    const user = userEvent.setup();
    tauri.setHandler("read_file", async ({ path }) => ({
      content: "body",
      path,
    }));
    tauri.setHandler("path_exists", async () => false);
    tauri.setHandler("write_file", async () => {});
    dialog.setSaveResult("/tmp/recovered.md");

    const { rerender } = renderEditor();
    rerender(
      <Editor
        sidebarOpen={false}
        onToggleSidebar={() => {}}
        externalFilePath="/tmp/original.md"
        onExternalFileConsumed={() => {}}
        onOpenErrorLog={() => {}}
      />,
    );
    await screen.findByText(/^original\.md$/);

    await user.click(screen.getByRole("button", { name: /save file/i }));

    // The in-app confirm asks whether to save as a new file. Click OK.
    const ok = await screen.findByRole("button", { name: /^ok$/i });
    await user.click(ok);
    expect(await screen.findByText(/^recovered\.md$/)).toBeInTheDocument();
  });
});
