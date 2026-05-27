import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "../Toolbar";
import { createMockEditor } from "../../../test/mockEditor";
import { tauri, dialog } from "../../../test/tauri";
import { ErrorProvider } from "../../../contexts/ErrorContext";

function renderToolbar(
  overrides: Partial<Parameters<typeof Toolbar>[0]> = {},
  editorOpts = {},
) {
  const editor = createMockEditor(editorOpts);
  const props = {
    editor,
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onNewDocument: vi.fn(),
    onToggleSidebar: vi.fn(),
    showHamburger: true,
    ...overrides,
  };
  const utils = render(
    <ErrorProvider>
      <Toolbar {...props} />
    </ErrorProvider>,
  );
  return { ...utils, ...props, editor };
}

describe("Toolbar", () => {
  beforeEach(() => {
    tauri.reset();
  });

  it("hides the hamburger when showHamburger is false", () => {
    renderToolbar({ showHamburger: false });
    expect(
      screen.queryByRole("button", { name: /toggle sidebar/i }),
    ).not.toBeInTheDocument();
  });

  it("invokes callbacks for open/save/new-document/toggle-sidebar", async () => {
    const user = userEvent.setup();
    const { onOpen, onSave, onNewDocument, onToggleSidebar } = renderToolbar();

    await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    await user.click(screen.getByRole("button", { name: /open file/i }));
    await user.click(screen.getByRole("button", { name: /save file/i }));
    await user.click(screen.getByRole("button", { name: /new document/i }));

    expect(onToggleSidebar).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onNewDocument).toHaveBeenCalledOnce();
  });

  it("fires editor chain commands for formatting buttons", async () => {
    const user = userEvent.setup();
    const { editor } = renderToolbar();

    await user.click(screen.getByRole("button", { name: /^bold$/i }));
    await user.click(screen.getByRole("button", { name: /^italic$/i }));
    await user.click(screen.getByRole("button", { name: /^underline$/i }));
    await user.click(screen.getByRole("button", { name: /strikethrough/i }));
    await user.click(screen.getByRole("button", { name: /inline code/i }));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls.map((c) => c[0]);
    expect(calls).toContain("toggleBold");
    expect(calls).toContain("toggleItalic");
    expect(calls).toContain("toggleUnderline");
    expect(calls).toContain("toggleStrike");
    expect(calls).toContain("toggleCode");
  });

  it("disables undo/redo based on editor.can()", () => {
    renderToolbar({}, { canUndo: false, canRedo: false });
    expect(screen.getByRole("button", { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /redo/i })).toBeDisabled();
  });

  it("reflects the active heading level in the trigger label", () => {
    renderToolbar({}, {
      active: {
        heading: (attrs?: Record<string, unknown>) => attrs?.level === 3,
      },
    });
    expect(screen.getByText("H3")).toBeInTheDocument();
  });

  it("shows heading options when the dropdown is opened and selects a level", async () => {
    const user = userEvent.setup();
    const { editor } = renderToolbar();

    await user.click(screen.getByTitle("Heading"));
    const h2 = await screen.findByRole("button", { name: /heading 2/i });
    await user.click(h2);

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls;
    const headingCall = calls.find((c) => c[0] === "toggleHeading");
    expect(headingCall).toBeDefined();
    expect(headingCall?.[1]).toContain("\"level\":2");
  });

  it("closes the heading dropdown on outside click", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByTitle("Heading"));
    expect(screen.getByText(/heading 2/i)).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByText(/heading 2/i)).not.toBeInTheDocument();
  });

  it("unsets the link when a link is already active", async () => {
    const user = userEvent.setup();
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockImplementation(() => "ignored");

    const { editor } = renderToolbar({}, { active: { link: true } });
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls.map((c) => c[0]);
    expect(calls).toContain("unsetLink");
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it("inserts a chosen image as a data URL", async () => {
    const user = userEvent.setup();
    dialog.setOpenResult("/tmp/pic.png");
    tauri.setHandler("read_file_as_data_url", async ({ path }) => {
      expect(path).toBe("/tmp/pic.png");
      return "data:image/png;base64,AAAA";
    });

    const { editor } = renderToolbar();
    await user.click(screen.getByRole("button", { name: /insert image/i }));

    // Wait a microtask for the async handler.
    await new Promise((r) => setTimeout(r, 0));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls;
    const setImage = calls.find((c) => c[0] === "setImage");
    expect(setImage).toBeDefined();
    expect(setImage?.[1]).toContain("data:image/png;base64,AAAA");
  });

  it("does nothing when the image picker is cancelled", async () => {
    const user = userEvent.setup();
    dialog.setOpenResult(null);

    const { editor } = renderToolbar();
    await user.click(screen.getByRole("button", { name: /insert image/i }));
    await new Promise((r) => setTimeout(r, 0));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls;
    expect(calls.find((c) => c[0] === "setImage")).toBeUndefined();
  });

  it("fires text-align commands", async () => {
    const user = userEvent.setup();
    const { editor } = renderToolbar();

    await user.click(screen.getByRole("button", { name: /align center/i }));
    await user.click(screen.getByRole("button", { name: /align right/i }));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls;
    const align = calls.filter((c) => c[0] === "setTextAlign");
    expect(align).toEqual(
      expect.arrayContaining([
        ["setTextAlign", "\"center\""],
        ["setTextAlign", "\"right\""],
      ]),
    );
  });

  it("applies and clears text color through the color dropdown", async () => {
    const user = userEvent.setup();
    const { editor } = renderToolbar();

    await user.click(screen.getByTitle("Text color"));
    await user.click(await screen.findByRole("button", { name: /^red$/i }));

    const calls = (
      editor as unknown as { __chainCalls: string[][] }
    ).__chainCalls;
    const setColor = calls.find((c) => c[0] === "setColor");
    expect(setColor?.[1]).toContain("#ef4444");

    await user.click(screen.getByTitle("Text color"));
    await user.click(await screen.findByRole("button", { name: /^default$/i }));
    expect(
      (editor as unknown as { __chainCalls: string[][] }).__chainCalls.find(
        (c) => c[0] === "unsetColor",
      ),
    ).toBeDefined();
  });
});
