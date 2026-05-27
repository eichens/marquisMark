import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  LogEntry,
  PushErrorInput,
  makeEntry,
  persistLog,
  readLog,
  clearLog as clearPersistedLog,
} from "../services/errorLog";

interface ConfirmRequest {
  id: string;
  message: string;
  resolve: (ok: boolean) => void;
}

interface ErrorContextValue {
  errors: LogEntry[];
  visibleErrors: LogEntry[];
  silenced: boolean;
  pushError: (input: PushErrorInput) => void;
  dismiss: (id: string) => void;
  setSilenced: (next: boolean) => void;
  clearAll: () => Promise<void>;
  reloadFromDisk: () => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  pendingConfirm: ConfirmRequest | null;
  resolveConfirm: (id: string, ok: boolean) => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

const MAX_VISIBLE = 3;

interface ProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ProviderProps) {
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [silenced, setSilencedState] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmRequest | null>(null);
  const silencedRef = useRef(false);

  useEffect(() => {
    silencedRef.current = silenced;
  }, [silenced]);

  // On mount, hydrate from the persisted log so the dashboard shows history
  // across sessions. Merge instead of replacing so any error pushed during
  // mount (e.g. a render-time crash captured by a boundary fallback) isn't
  // clobbered by the async hydration landing later.
  useEffect(() => {
    let canceled = false;
    (async () => {
      const persisted = await readLog();
      if (canceled) return;
      setErrors((current) => {
        const seen = new Set(current.map((e) => e.id));
        const merged = [...persisted.filter((e) => !seen.has(e.id)), ...current];
        return merged;
      });
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const pushError = useCallback((input: PushErrorInput) => {
    const entry = makeEntry(input);
    setErrors((prev) => [...prev, entry]);
    persistLog(entry);
    if (!silencedRef.current) {
      setVisibleIds((prev) => {
        const next = [...prev, entry.id];
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setVisibleIds((prev) => prev.filter((vid) => vid !== id));
  }, []);

  const setSilenced = useCallback((next: boolean) => {
    setSilencedState(next);
    if (next) setVisibleIds([]);
  }, []);

  const clearAll = useCallback(async () => {
    await clearPersistedLog();
    setErrors([]);
    setVisibleIds([]);
  }, []);

  const reloadFromDisk = useCallback(async () => {
    const persisted = await readLog();
    setErrors(persisted);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPendingConfirm({ id, message, resolve });
    });
  }, []);

  const resolveConfirm = useCallback((id: string, ok: boolean) => {
    setPendingConfirm((current) => {
      if (!current || current.id !== id) return current;
      current.resolve(ok);
      return null;
    });
  }, []);

  const visibleErrors = useMemo(
    () =>
      visibleIds
        .map((id) => errors.find((e) => e.id === id))
        .filter((e): e is LogEntry => e !== undefined),
    [visibleIds, errors],
  );

  const value = useMemo<ErrorContextValue>(
    () => ({
      errors,
      visibleErrors,
      silenced,
      pushError,
      dismiss,
      setSilenced,
      clearAll,
      reloadFromDisk,
      confirm,
      pendingConfirm,
      resolveConfirm,
    }),
    [
      errors,
      visibleErrors,
      silenced,
      pushError,
      dismiss,
      setSilenced,
      clearAll,
      reloadFromDisk,
      confirm,
      pendingConfirm,
      resolveConfirm,
    ],
  );

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

export function useErrorLog(): ErrorContextValue {
  const ctx = useContext(ErrorContext);
  if (!ctx) {
    throw new Error("useErrorLog must be used within an ErrorProvider");
  }
  return ctx;
}
