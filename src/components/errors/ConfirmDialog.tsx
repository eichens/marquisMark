import { useEffect, useRef } from "react";
import { useErrorLog } from "../../contexts/ErrorContext";

export function ConfirmDialog() {
  const { pendingConfirm, resolveConfirm } = useErrorLog();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pendingConfirm) {
      confirmRef.current?.focus();
    }
  }, [pendingConfirm?.id]);

  if (!pendingConfirm) return null;

  const onCancel = () => resolveConfirm(pendingConfirm.id, false);
  const onOk = () => resolveConfirm(pendingConfirm.id, true);

  return (
    <div
      className="confirm-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onOk();
      }}
    >
      <div className="confirm-dialog">
        <p className="confirm-dialog-message">{pendingConfirm.message}</p>
        <div className="confirm-dialog-buttons">
          <button ref={cancelRef} className="confirm-dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button ref={confirmRef} className="confirm-dialog-ok" onClick={onOk}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
