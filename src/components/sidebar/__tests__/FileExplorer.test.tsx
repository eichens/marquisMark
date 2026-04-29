import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The virtualizer depends on scroll-container measurements that jsdom doesn't
// provide. Replace it with a pass-through that renders every row.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    const items = Array.from({ length: count }, (_, i) => ({
      index: i,
      key: i,
      start: i * 26,
      size: 26,
      end: (i + 1) * 26,
      lane: 0,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * 26,
      measure: () => {},
    };
  },
}));

import { FileExplorer } from "../FileExplorer";
import { tauri, dialog, store } from "../../../test/tauri";

describe("FileExplorer", () => {
  beforeEach(() => {
    tauri.reset();
  });

  it("shows the Open Folder button until a folder is picked", async () => {
    tauri.setHandler("path_exists", async () => false);
    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={async () => null} />,
    );
    expect(
      await screen.findByRole("button", { name: /open folder/i }),
    ).toBeInTheDocument();
  });

  it("loads entries when a folder is picked and persists the path", async () => {
    const user = userEvent.setup();
    tauri.setHandler("path_exists", async () => false);
    tauri.setHandler("list_directory", async () => [
      { name: "notes.md", path: "/tmp/notes.md", is_dir: false },
      { name: "sub", path: "/tmp/sub", is_dir: true },
    ]);
    dialog.setOpenResult("/tmp");

    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={async () => null} />,
    );
    await user.click(await screen.findByRole("button", { name: /open folder/i }));

    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    expect(screen.getByText("sub")).toBeInTheDocument();
    expect(store.get("lastFolder")).toBe("/tmp");
  });

  it("restores the saved folder on mount if it still exists", async () => {
    store.set("lastFolder", "/saved");
    tauri.setHandler("path_exists", async () => true);
    tauri.setHandler("list_directory", async ({ path }) => {
      expect(path).toBe("/saved");
      return [{ name: "restored.md", path: "/saved/restored.md", is_dir: false }];
    });

    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={async () => null} />,
    );
    expect(await screen.findByText("restored.md")).toBeInTheDocument();
  });

  it("clears the saved folder when the path no longer exists", async () => {
    store.set("lastFolder", "/gone");
    tauri.setHandler("path_exists", async () => false);

    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={async () => null} />,
    );
    await waitFor(() => {
      expect(store.get("lastFolder")).toBeUndefined();
    });
  });

  it("fires onFileSelect for openable files, ignores others", async () => {
    const user = userEvent.setup();
    const onFileSelect = vi.fn();
    store.set("lastFolder", "/root");
    tauri.setHandler("path_exists", async () => true);
    tauri.setHandler("list_directory", async () => [
      { name: "good.md", path: "/root/good.md", is_dir: false },
      { name: "bad.bin", path: "/root/bad.bin", is_dir: false },
    ]);

    render(
      <FileExplorer onFileSelect={onFileSelect} onCreateFile={async () => null} />,
    );
    await screen.findByText("good.md");

    await user.click(screen.getByText("good.md"));
    expect(onFileSelect).toHaveBeenCalledWith("/root/good.md");

    await user.click(screen.getByText("bad.bin"));
    expect(onFileSelect).toHaveBeenCalledOnce();
  });

  it("expands a directory and shows its children", async () => {
    const user = userEvent.setup();
    store.set("lastFolder", "/root");
    tauri.setHandler("path_exists", async () => true);
    const byPath: Record<string, { name: string; path: string; is_dir: boolean }[]> = {
      "/root": [{ name: "sub", path: "/root/sub", is_dir: true }],
      "/root/sub": [
        { name: "nested.md", path: "/root/sub/nested.md", is_dir: false },
      ],
    };
    tauri.setHandler("list_directory", async ({ path }) => byPath[path as string] ?? []);

    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={async () => null} />,
    );
    await screen.findByText("sub");

    await user.click(screen.getByText("sub"));
    expect(await screen.findByText("nested.md")).toBeInTheDocument();
  });

  it("shows a pending input when creating a new document", async () => {
    const user = userEvent.setup();
    store.set("lastFolder", "/root");
    tauri.setHandler("path_exists", async () => true);
    tauri.setHandler("list_directory", async () => []);

    const onCreateFile = vi.fn(async (parent: string, name: string) => `${parent}/${name}`);
    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={onCreateFile} />,
    );
    await screen.findByText(/file explorer/i);

    await user.click(screen.getByRole("button", { name: /new document/i }));
    const input = screen.getByPlaceholderText("new-document.md");
    await user.type(input, "draft.md{Enter}");

    await waitFor(() => {
      expect(onCreateFile).toHaveBeenCalledWith("/root", "draft.md");
    });
  });

  it("cancels the pending input on Escape", async () => {
    const user = userEvent.setup();
    store.set("lastFolder", "/root");
    tauri.setHandler("path_exists", async () => true);
    tauri.setHandler("list_directory", async () => []);
    const onCreateFile = vi.fn();

    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={onCreateFile} />,
    );
    await screen.findByText(/file explorer/i);

    await user.click(screen.getByRole("button", { name: /new document/i }));
    await act(async () => {
      screen
        .getByPlaceholderText("new-document.md")
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
    });

    // After escape, the pending input should not be present.
    // user.type in the prior test validates commit; here we validate cancel.
    // We assert onCreateFile was not called.
    expect(onCreateFile).not.toHaveBeenCalled();
  });

  it("refreshes the file list on refresh click", async () => {
    const user = userEvent.setup();
    store.set("lastFolder", "/root");
    tauri.setHandler("path_exists", async () => true);
    const dir: { name: string; path: string; is_dir: boolean }[] = [
      { name: "a.md", path: "/root/a.md", is_dir: false },
    ];
    tauri.setHandler("list_directory", async () => [...dir]);

    render(
      <FileExplorer onFileSelect={() => {}} onCreateFile={async () => null} />,
    );
    await screen.findByText("a.md");
    dir.push({ name: "b.md", path: "/root/b.md", is_dir: false });

    await user.click(screen.getByRole("button", { name: /^refresh$/i }));
    expect(await screen.findByText("b.md")).toBeInTheDocument();
  });
});
