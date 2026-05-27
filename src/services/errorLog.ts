import { invoke } from "@tauri-apps/api/core";

export type LogLevel = "error" | "warn" | "info";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  stack?: string;
  context?: string;
}

export interface PushErrorInput {
  message: string;
  level?: LogLevel;
  source?: string;
  stack?: string;
  context?: string;
}

export function makeEntry(input: PushErrorInput): LogEntry {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    timestamp: new Date().toISOString(),
    level: input.level ?? "error",
    message: input.message,
    source: input.source,
    stack: input.stack,
    context: input.context,
  };
}

export async function persistLog(entry: LogEntry): Promise<void> {
  try {
    await invoke("log_event", { entry });
  } catch (e) {
    // Don't recurse into the error system if logging fails — that would be
    // catastrophic when the failure mode IS that logging is broken.
    console.error("Failed to persist log entry:", e, entry);
  }
}

export async function readLog(): Promise<LogEntry[]> {
  try {
    return await invoke<LogEntry[]>("read_log");
  } catch (e) {
    console.error("Failed to read log:", e);
    return [];
  }
}

export async function clearLog(): Promise<void> {
  try {
    await invoke("clear_log");
  } catch (e) {
    console.error("Failed to clear log:", e);
  }
}
