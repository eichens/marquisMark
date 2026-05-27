import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Editor, EditorHandle } from "./components/editor/Editor";
import { Sidebar, SidebarHandle } from "./components/sidebar/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLogo } from "./components/AppLogo";
import { ErrorProvider, useErrorLog } from "./contexts/ErrorContext";
import { ErrorBannerStack } from "./components/errors/ErrorBannerStack";
import { ErrorDashboard } from "./components/errors/ErrorDashboard";
import { ConfirmDialog } from "./components/errors/ConfirmDialog";
import { GlobalErrorListeners } from "./components/errors/GlobalErrorListeners";

function AppShell() {
  const { pushError } = useErrorLog();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [externalFilePath, setExternalFilePath] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const sidebarRef = useRef<SidebarHandle>(null);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((o) => !o);
  }, []);

  const handleExternalFileConsumed = useCallback(() => {
    setExternalFilePath(null);
  }, []);

  const handleOpenDashboard = useCallback(() => setDashboardOpen(true), []);
  const handleCloseDashboard = useCallback(() => setDashboardOpen(false), []);

  const handleFileSaved = useCallback(() => {
    sidebarRef.current?.refresh();
  }, []);

  const handleCreateFile = useCallback(
    async (parentPath: string, name: string): Promise<string | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const finalName = /\.(md|mdx|markdown|txt)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
      const sep = parentPath.includes("\\") && !parentPath.includes("/") ? "\\" : "/";
      const fullPath = `${parentPath.replace(/[/\\]+$/, "")}${sep}${finalName}`;

      const saved = await (editorRef.current?.saveIfDirty() ?? Promise.resolve(true));
      if (!saved) return null;

      try {
        const exists = await invoke<boolean>("path_exists", { path: fullPath });
        if (exists) {
          pushError({
            message: `A file named "${finalName}" already exists in this folder.`,
            level: "warn",
            source: "create_file",
          });
          return null;
        }
        await invoke("write_file", { path: fullPath, content: "" });
        setExternalFilePath(fullPath);
        return fullPath;
      } catch (e) {
        console.error("Create file error:", e);
        pushError({ message: `Failed to create file: ${e}`, source: "create_file" });
        return null;
      }
    },
    [pushError],
  );

  return (
    <div className="app">
      <header className="app-header" data-tauri-drag-region>
        <AppLogo className="app-header-icon" size={18} data-tauri-drag-region />
        <span className="app-header-title" data-tauri-drag-region>
          Marquis Mark <span className="app-header-sep">|</span> Mark 1
        </span>
      </header>
      <div className="app-body">
        <Sidebar
          ref={sidebarRef}
          isOpen={sidebarOpen}
          onClose={handleToggleSidebar}
          onFileSelect={setExternalFilePath}
          onCreateFile={handleCreateFile}
        />
        <div className="editor-pane">
          <ErrorBoundary>
            <Editor
              ref={editorRef}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={handleToggleSidebar}
              externalFilePath={externalFilePath}
              onExternalFileConsumed={handleExternalFileConsumed}
              onOpenErrorLog={handleOpenDashboard}
              onFileSaved={handleFileSaved}
            />
          </ErrorBoundary>
          {dashboardOpen && <ErrorDashboard onClose={handleCloseDashboard} />}
        </div>
      </div>
      <ErrorBannerStack />
      <ConfirmDialog />
      <GlobalErrorListeners />
    </div>
  );
}

function App() {
  return (
    <ErrorProvider>
      <AppShell />
    </ErrorProvider>
  );
}

export default App;
