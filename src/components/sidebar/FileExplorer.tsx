import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { FolderOpen, RefreshCw, SquarePen, File } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileTreeRow, VisibleRow } from "./FileTreeRow";

// Sentinel path for the in-progress "new document" row. When present in the
// visible list, the row renders as an `<input>` instead of a `FileTreeRow`.
// Must not collide with any real filesystem path.
const PENDING_PATH = "__pending__";
const STORE_FILE = "settings.json";
const LAST_FOLDER_KEY = "lastFolder";
const store = new LazyStore(STORE_FILE);

interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  onCreateFile: (parentPath: string, name: string) => Promise<string | null>;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  depth: number;
  expanded: boolean;
  loading: boolean;
  children: TreeNode[] | null;
}

const OPENABLE_EXTENSIONS = ["md", "mdx", "markdown", "txt"];
const ROW_HEIGHT = 26;

function isOpenable(name: string, isDir: boolean): boolean {
  if (isDir) return true;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return OPENABLE_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

function basename(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const match = normalized.split(/[/\\]/).pop();
  return match || path;
}

function toNodes(entries: DirEntry[], depth: number): TreeNode[] {
  return entries.map((e) => ({
    name: e.name,
    path: e.path,
    isDir: e.is_dir,
    depth,
    expanded: false,
    loading: false,
    children: null,
  }));
}

/**
 * Flatten the nested tree to the visible-row list the virtualizer consumes.
 * Collapsed subtrees contribute nothing; expanded-but-still-loading subtrees
 * emit a single "Loading…" sentinel row so the user sees feedback.
 */
function flatten(nodes: TreeNode[], out: VisibleRow[]): void {
  for (const n of nodes) {
    out.push({
      name: n.name,
      path: n.path,
      isDir: n.isDir,
      depth: n.depth,
      expanded: n.expanded,
      loading: n.loading,
      openable: isOpenable(n.name, n.isDir),
    });
    if (n.isDir && n.expanded && n.children) {
      flatten(n.children, out);
    }
    if (n.isDir && n.expanded && n.loading && !n.children) {
      out.push({
        name: "Loading…",
        path: `${n.path}::loading`,
        isDir: false,
        depth: n.depth + 1,
        expanded: false,
        loading: true,
        openable: false,
      });
    }
  }
}

/**
 * Return a new tree with the node at `path` transformed by `updater`.
 * Immutable so React re-renders correctly; uncles/siblings keep their refs so
 * the virtualizer doesn't thrash keys for rows that didn't change.
 */
function updateNode(nodes: TreeNode[], path: string, updater: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === path) return updater(n);
    if (n.children) {
      return { ...n, children: updateNode(n.children, path, updater) };
    }
    return n;
  });
}

export function FileExplorer({ onFileSelect, onCreateFile }: FileExplorerProps) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingInputRef = useRef<HTMLInputElement | null>(null);

  const visible = useMemo(() => {
    const out: VisibleRow[] = [];
    if (pendingName !== null) {
      out.push({
        name: pendingName,
        path: PENDING_PATH,
        isDir: false,
        depth: 0,
        expanded: false,
        loading: false,
        openable: false,
      });
    }
    flatten(tree, out);
    return out;
  }, [tree, pendingName]);

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [visible.length, virtualizer]);

  // Shared by `pickFolder` (persist=true) and the restore-on-mount effect
  // (persist=false): restoring shouldn't rewrite a value we already have.
  // On failure during restore we clear the stored path so next mount doesn't
  // keep trying to reload a deleted folder.
  const loadFolder = useCallback(async (path: string, persist: boolean) => {
    try {
      const entries = await invoke<DirEntry[]>("list_directory", { path });
      setRootPath(path);
      setTree(toNodes(entries, 0));
      if (persist) {
        try {
          await store.set(LAST_FOLDER_KEY, path);
          await store.save();
        } catch (e) {
          console.error("Failed to persist last folder:", e);
        }
      }
    } catch (e) {
      console.error("Failed to list directory:", e);
      if (persist) {
        try {
          await store.delete(LAST_FOLDER_KEY);
          await store.save();
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const pickFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    await loadFolder(selected as string, true);
  }, [loadFolder]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const saved = await store.get<string>(LAST_FOLDER_KEY);
        if (canceled || !saved) return;
        const exists = await invoke<boolean>("path_exists", { path: saved });
        if (canceled || !exists) {
          if (!exists) {
            await store.delete(LAST_FOLDER_KEY);
            await store.save();
          }
          return;
        }
        await loadFolder(saved, false);
      } catch (e) {
        console.error("Failed to restore last folder:", e);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [loadFolder]);

  const refresh = useCallback(async () => {
    if (!rootPath) return;
    try {
      const entries = await invoke<DirEntry[]>("list_directory", { path: rootPath });
      setTree(toNodes(entries, 0));
    } catch (e) {
      console.error("Failed to refresh directory:", e);
    }
  }, [rootPath]);

  const startNewDocument = useCallback(() => {
    if (!rootPath || pendingName !== null) return;
    setPendingName("");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rootPath, pendingName]);

  const cancelPending = useCallback(() => {
    setPendingName(null);
  }, []);

  const commitPending = useCallback(async () => {
    if (!rootPath || pendingName === null || creating) return;
    const name = pendingName.trim();
    if (!name) {
      setPendingName(null);
      return;
    }
    setCreating(true);
    try {
      const createdPath = await onCreateFile(rootPath, name);
      setPendingName(null);
      if (createdPath) {
        try {
          const entries = await invoke<DirEntry[]>("list_directory", { path: rootPath });
          setTree(toNodes(entries, 0));
        } catch (e) {
          console.error("Failed to refresh after create:", e);
        }
      }
    } finally {
      setCreating(false);
    }
  }, [rootPath, pendingName, creating, onCreateFile]);

  useEffect(() => {
    if (pendingName !== null && pendingInputRef.current) {
      pendingInputRef.current.focus();
    }
  }, [pendingName !== null]);

  const handleActivate = useCallback(
    async (row: VisibleRow) => {
      if (!row.openable) return;
      if (!row.isDir) {
        onFileSelect(row.path);
        return;
      }
      const targetPath = row.path;
      if (row.expanded) {
        setTree((t) => updateNode(t, targetPath, (n) => ({ ...n, expanded: false })));
        return;
      }
      setTree((t) =>
        updateNode(t, targetPath, (n) =>
          n.children
            ? { ...n, expanded: true }
            : { ...n, expanded: true, loading: true },
        ),
      );
      try {
        const entries = await invoke<DirEntry[]>("list_directory", { path: targetPath });
        setTree((t) =>
          updateNode(t, targetPath, (n) => ({
            ...n,
            loading: false,
            children: toNodes(entries, n.depth + 1),
          })),
        );
      } catch {
        setTree((t) =>
          updateNode(t, targetPath, (n) => ({
            ...n,
            loading: false,
            children: [],
          })),
        );
      }
    },
    [onFileSelect],
  );

  const rootName = rootPath ? basename(rootPath) : null;
  const items = virtualizer.getVirtualItems();

  return (
    <div className="sidebar-file-explorer">
      <div className="sidebar-section-header">
        <FolderOpen size={14} />
        <span className="sidebar-section-title">{rootName || "File Explorer"}</span>
        {rootPath && (
          <>
            <button
              className="sidebar-section-action"
              onClick={startNewDocument}
              title="New document"
              disabled={pendingName !== null}
            >
              <SquarePen size={12} />
            </button>
            <button
              className="sidebar-section-action"
              onClick={refresh}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
          </>
        )}
      </div>
      {rootPath === null ? (
        <div className="sidebar-empty">
          <button className="sidebar-open-folder" onClick={pickFolder}>
            Open Folder
          </button>
        </div>
      ) : (
        <>
          <div className="file-tree" ref={scrollRef}>
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {items.map((virtualRow) => {
                const row = visible[virtualRow.index];
                const isPending = row.path === PENDING_PATH;
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isPending ? (
                      <div
                        className="file-tree-node pending"
                        style={{ paddingLeft: `${row.depth + 0.5}rem` }}
                      >
                        <span className="tree-chevron-spacer" />
                        <File size={14} />
                        <input
                          ref={pendingInputRef}
                          className="tree-pending-input"
                          value={pendingName ?? ""}
                          placeholder="new-document.md"
                          onChange={(e) => setPendingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitPending();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelPending();
                            }
                          }}
                          onBlur={() => {
                            if (!creating) commitPending();
                          }}
                          disabled={creating}
                        />
                      </div>
                    ) : (
                      <FileTreeRow row={row} onActivate={handleActivate} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button className="sidebar-change-folder" onClick={pickFolder}>
            Change Folder
          </button>
        </>
      )}
    </div>
  );
}
