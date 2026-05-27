import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useErrorLog } from "../../contexts/ErrorContext";
import { LogEntry } from "../../services/errorLog";

const AUTO_DISMISS_MS = 6000;

interface BannerProps {
  entry: LogEntry;
  onDismiss: (id: string) => void;
}

function Banner({ entry, onDismiss }: BannerProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(entry.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [entry.id, onDismiss]);

  return (
    <div className={`error-banner level-${entry.level}`} role="status">
      <AlertTriangle size={14} className="error-banner-icon" />
      <span className="error-banner-message">{entry.message}</span>
      <button
        className="error-banner-dismiss"
        onClick={() => onDismiss(entry.id)}
        aria-label="Dismiss error"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ErrorBannerStack() {
  const { visibleErrors, dismiss } = useErrorLog();
  if (visibleErrors.length === 0) return null;
  return (
    <div className="error-banner-stack" aria-live="polite">
      {visibleErrors.map((entry) => (
        <Banner key={entry.id} entry={entry} onDismiss={dismiss} />
      ))}
    </div>
  );
}
