import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileTreeRow, VisibleRow } from "../FileTreeRow";

function row(overrides: Partial<VisibleRow> = {}): VisibleRow {
  return {
    name: "foo.md",
    path: "/tmp/foo.md",
    isDir: false,
    depth: 0,
    expanded: false,
    loading: false,
    openable: true,
    ...overrides,
  };
}

describe("FileTreeRow", () => {
  it("shows a chevron and directory icon for folders", () => {
    const { container } = render(
      <FileTreeRow row={row({ isDir: true })} onActivate={() => {}} />,
    );
    expect(container.querySelector(".directory")).not.toBeNull();
    expect(container.querySelector(".tree-chevron")).not.toBeNull();
  });

  it("shows a spacer instead of a chevron for files", () => {
    const { container } = render(
      <FileTreeRow row={row()} onActivate={() => {}} />,
    );
    expect(container.querySelector(".tree-chevron-spacer")).not.toBeNull();
    expect(container.querySelector(".tree-chevron")).toBeNull();
  });

  it("applies a disabled class when not openable", () => {
    const { container } = render(
      <FileTreeRow row={row({ openable: false })} onActivate={() => {}} />,
    );
    expect(container.querySelector(".disabled")).not.toBeNull();
  });

  it("invokes onActivate when clicked", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<FileTreeRow row={row()} onActivate={onActivate} />);
    await user.click(screen.getByText("foo.md"));
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onActivate.mock.calls[0][0].path).toBe("/tmp/foo.md");
  });

  it("pads per depth level", () => {
    const { container } = render(
      <FileTreeRow row={row({ depth: 3 })} onActivate={() => {}} />,
    );
    const node = container.querySelector(".file-tree-node") as HTMLElement;
    expect(node.style.paddingLeft).toBe("3.5rem");
  });
});
