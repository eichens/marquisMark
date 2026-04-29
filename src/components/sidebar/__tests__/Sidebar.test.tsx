import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../Sidebar";
import { tauri } from "../../../test/tauri";

describe("Sidebar", () => {
  beforeEach(() => {
    tauri.reset();
    // The embedded FileExplorer calls path_exists on mount via a restore
    // effect; let it resolve to false so no folder load happens.
    tauri.setHandler("path_exists", async () => false);
  });

  it("applies the `open` class when isOpen is true", () => {
    const { container } = render(
      <Sidebar
        isOpen={true}
        onClose={() => {}}
        onFileSelect={() => {}}
        onCreateFile={async () => null}
      />,
    );
    expect(container.querySelector(".sidebar.open")).not.toBeNull();
  });

  it("omits the `open` class when closed", () => {
    const { container } = render(
      <Sidebar
        isOpen={false}
        onClose={() => {}}
        onFileSelect={() => {}}
        onCreateFile={async () => null}
      />,
    );
    expect(container.querySelector(".sidebar.open")).toBeNull();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sidebar
        isOpen={true}
        onClose={onClose}
        onFileSelect={() => {}}
        onCreateFile={async () => null}
      />,
    );
    await user.click(screen.getByRole("button", { name: /close sidebar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders the embedded file explorer and settings sections", () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={() => {}}
        onFileSelect={() => {}}
        onCreateFile={async () => null}
      />,
    );
    expect(screen.getByText(/file explorer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });
});
