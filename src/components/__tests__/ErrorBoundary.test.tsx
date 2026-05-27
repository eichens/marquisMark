import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorProvider, useErrorLog } from "../../contexts/ErrorContext";
import { GlobalErrorListeners } from "../errors/GlobalErrorListeners";

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>happy path</div>;
}

function ErrorCount() {
  const { errors } = useErrorLog();
  return <div data-testid="count">{errors.length}</div>;
}

function ErrorMessages() {
  const { errors } = useErrorLog();
  return (
    <ul data-testid="messages">
      {errors.map((e) => (
        <li key={e.id}>{e.message}</li>
      ))}
    </ul>
  );
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error", () => {
    render(
      <ErrorProvider>
        <ErrorBoundary>
          <Thrower shouldThrow={false} />
        </ErrorBoundary>
      </ErrorProvider>,
    );
    expect(screen.getByText("happy path")).toBeInTheDocument();
  });

  it("catches render errors, shows fallback, and logs the error", async () => {
    render(
      <ErrorProvider>
        <ErrorBoundary>
          <Thrower shouldThrow={true} />
        </ErrorBoundary>
        <ErrorMessages />
      </ErrorProvider>,
    );
    expect(screen.getByText(/this view crashed/i)).toBeInTheDocument();
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("resets back to children when Try again is clicked", async () => {
    const user = userEvent.setup();
    function Flipper() {
      return <Thrower shouldThrow={false} />;
    }
    const { rerender } = render(
      <ErrorProvider>
        <ErrorBoundary>
          <Thrower shouldThrow={true} />
        </ErrorBoundary>
      </ErrorProvider>,
    );
    expect(screen.getByText(/this view crashed/i)).toBeInTheDocument();
    rerender(
      <ErrorProvider>
        <ErrorBoundary>
          <Flipper />
        </ErrorBoundary>
      </ErrorProvider>,
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("happy path")).toBeInTheDocument();
  });

  it("GlobalErrorListeners catches window error events into the log", async () => {
    render(
      <ErrorProvider>
        <GlobalErrorListeners />
        <ErrorCount />
      </ErrorProvider>,
    );
    act(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("async-boom"),
          message: "async-boom",
        }),
      );
    });
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("GlobalErrorListeners catches unhandled promise rejections into the log", async () => {
    render(
      <ErrorProvider>
        <GlobalErrorListeners />
        <ErrorCount />
      </ErrorProvider>,
    );
    act(() => {
      const evt = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.defineProperty(evt, "reason", { value: new Error("rejected") });
      window.dispatchEvent(evt);
    });
    expect(await screen.findByText("1")).toBeInTheDocument();
  });
});
