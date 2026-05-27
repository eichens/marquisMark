import { useState, useMemo } from "react";
import { X, Trash2, BellOff, Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useErrorLog } from "../../contexts/ErrorContext";
import { LogEntry } from "../../services/errorLog";

interface ErrorDashboardProps {
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

function ErrorDetail({ entry, onBack }: { entry: LogEntry; onBack: () => void }) {
  return (
    <div className="error-detail">
      <button className="error-detail-back" onClick={onBack}>
        ← Back to list
      </button>
      <div className="error-detail-header">
        <div className={`error-detail-level level-${entry.level}`}>{entry.level}</div>
        <span className="error-detail-time">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <h3 className="error-detail-message">{entry.message}</h3>
      {entry.source && (
        <section className="error-detail-section">
          <h4>Source</h4>
          <pre>{entry.source}</pre>
        </section>
      )}
      {entry.context && (
        <section className="error-detail-section">
          <h4>Context</h4>
          <pre>{entry.context}</pre>
        </section>
      )}
      {entry.stack && (
        <section className="error-detail-section">
          <h4>Stack</h4>
          <pre>{entry.stack}</pre>
        </section>
      )}
      <section className="error-detail-section">
        <h4>ID</h4>
        <pre>{entry.id}</pre>
      </section>
    </div>
  );
}

export function ErrorDashboard({ onClose }: ErrorDashboardProps) {
  const { errors, silenced, setSilenced, clearAll, reloadFromDisk } = useErrorLog();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...errors].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [errors],
  );

  const selected = selectedId ? errors.find((e) => e.id === selectedId) ?? null : null;

  return (
    <div className="error-dashboard">
      <header className="error-dashboard-header">
        <h2>Error log</h2>
        <span className="error-dashboard-count">
          {errors.length} {errors.length === 1 ? "entry" : "entries"}
        </span>
        <span className="error-dashboard-spacer" />
        <button
          className="error-dashboard-action"
          onClick={reloadFromDisk}
          title="Reload from disk"
        >
          <RefreshCw size={14} />
        </button>
        <button
          className="error-dashboard-action"
          onClick={() => setSilenced(!silenced)}
          title={silenced ? "Unsilence error banners" : "Silence error banners"}
        >
          {silenced ? <BellOff size={14} /> : <Bell size={14} />}
          <span>{silenced ? "Silenced" : "Silence"}</span>
        </button>
        <button
          className="error-dashboard-action"
          onClick={() => {
            setSelectedId(null);
            void clearAll();
          }}
          title="Clear all errors"
        >
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
        <button
          className="error-dashboard-close"
          onClick={onClose}
          title="Close error log"
          aria-label="Close error log"
        >
          <X size={16} />
        </button>
      </header>
      <div className="error-dashboard-body">
        {selected ? (
          <ErrorDetail entry={selected} onBack={() => setSelectedId(null)} />
        ) : sorted.length === 0 ? (
          <div className="error-dashboard-empty">No errors logged.</div>
        ) : (
          <ul className="error-dashboard-list">
            {sorted.map((entry) => (
              <li key={entry.id}>
                <button
                  className="error-dashboard-row"
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className={`error-dashboard-level level-${entry.level}`}>
                    {entry.level}
                  </span>
                  <span className="error-dashboard-time">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span className="error-dashboard-message">{entry.message}</span>
                  <ChevronRight size={14} className="error-dashboard-chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
