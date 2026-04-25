import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Editor, EditorHandle } from "./components/editor/Editor";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [externalFilePath, setExternalFilePath] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle>(null);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((o) => !o);
  }, []);

  const handleExternalFileConsumed = useCallback(() => {
    setExternalFilePath(null);
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
          window.alert(`A file named "${finalName}" already exists in this folder.`);
          return null;
        }
        await invoke("write_file", { path: fullPath, content: "" });
        setExternalFilePath(fullPath);
        return fullPath;
      } catch (e) {
        console.error("Create file error:", e);
        window.alert(`Failed to create file: ${e}`);
        return null;
      }
    },
    [],
  );

  return (
    <div className="app">
      <Sidebar
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
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;
