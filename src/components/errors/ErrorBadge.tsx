import { AlertTriangle } from "lucide-react";
import { useErrorLog } from "../../contexts/ErrorContext";

interface ErrorBadgeProps {
  onClick: () => void;
}

export function ErrorBadge({ onClick }: ErrorBadgeProps) {
  const { errors } = useErrorLog();
  const count = errors.length;
  return (
    <button
      type="button"
      className={`error-badge ${count > 0 ? "has-errors" : ""}`}
      onClick={onClick}
      title={count === 0 ? "No errors" : `${count} ${count === 1 ? "error" : "errors"} — open log`}
      aria-label="Open error log"
    >
      <AlertTriangle size={12} />
      {count > 0 && <span className="error-badge-count">{count}</span>}
    </button>
  );
}
