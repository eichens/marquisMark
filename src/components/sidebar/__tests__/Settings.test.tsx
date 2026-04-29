import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings } from "../Settings";

describe("Settings", () => {
  it("starts collapsed", () => {
    render(<Settings />);
    expect(screen.queryByText(/no settings yet/i)).not.toBeInTheDocument();
  });

  it("expands and collapses when the header is clicked", async () => {
    const user = userEvent.setup();
    render(<Settings />);
    const header = screen.getByRole("button", { name: /settings/i });

    await user.click(header);
    expect(screen.getByText(/no settings yet/i)).toBeInTheDocument();

    await user.click(header);
    expect(screen.queryByText(/no settings yet/i)).not.toBeInTheDocument();
  });
});
