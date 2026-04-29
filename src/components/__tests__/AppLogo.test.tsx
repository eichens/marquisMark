import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AppLogo } from "../AppLogo";

describe("AppLogo", () => {
  it("renders an aria-hidden svg", () => {
    const { container } = render(<AppLogo />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("uses default size 18 and scales width proportionally", () => {
    const { container } = render(<AppLogo />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("height")).toBe("18");
    // width = (64/57) * 18
    expect(svg.getAttribute("width")).toBe(String((64 / 57) * 18));
  });

  it("respects size prop", () => {
    const { container } = render(<AppLogo size={36} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("height")).toBe("36");
    expect(svg.getAttribute("width")).toBe(String((64 / 57) * 36));
  });

  it("applies the className prop", () => {
    const { container } = render(<AppLogo className="custom-class" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("custom-class");
  });
});
