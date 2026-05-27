import { useEffect } from "react";
import { useErrorLog } from "../../contexts/ErrorContext";

export function GlobalErrorListeners() {
  const { pushError } = useErrorLog();

  useEffect(() => {
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      const err = reason instanceof Error ? reason : new Error(String(reason));
      pushError({
        message: err.message,
        stack: err.stack,
        source: "unhandledrejection",
      });
    }
    function onError(e: ErrorEvent) {
      const err = e.error instanceof Error ? e.error : new Error(e.message);
      pushError({
        message: err.message,
        stack: err.stack,
        source: "window.error",
      });
    }
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [pushError]);

  return null;
}
