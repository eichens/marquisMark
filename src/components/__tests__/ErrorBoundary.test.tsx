import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../ErrorBoundary";

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>happy path</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs caught errors to console.error; silence for a clean test output.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("happy path")).toBeInTheDocument();
  });

  it("catches render errors and shows the error message", () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("resets back to children when Try again is clicked", async () => {
    const user = userEvent.setup();

    // Flip-able component so we can toggle shouldThrow after render.
    function Flipper() {
      return <Thrower shouldThrow={false} />;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    // Swap the tree to a version that does not throw before resetting.
    rerender(
      <ErrorBoundary>
        <Flipper />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("happy path")).toBeInTheDocument();
  });

  it("catches window error events", () => {
    render(
      <ErrorBoundary>
        <div>child</div>
      </ErrorBoundary>,
    );
    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("async-boom"),
          message: "async-boom",
        }),
      );
    });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("async-boom")).toBeInTheDocument();
  });

  it("catches unhandled promise rejections", () => {
    render(
      <ErrorBoundary>
        <div>child</div>
      </ErrorBoundary>,
    );
    act(() => {
      const evt = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(evt, "reason", { value: new Error("rejected") });
      window.dispatchEvent(evt);
    });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("rejected")).toBeInTheDocument();
  });
});
