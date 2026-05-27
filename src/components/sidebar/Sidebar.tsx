import { forwardRef, useImperativeHandle, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { FileExplorer, FileExplorerHandle } from "./FileExplorer";
import { Settings } from "./Settings";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (parentPath: string, name: string) => Promise<string | null>;
}

export interface SidebarHandle {
  refresh: () => void;
}

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(function Sidebar(
  { isOpen, onClose, onFileSelect, onCreateFile },
  ref,
) {
  const explorerRef = useRef<FileExplorerHandle>(null);

  useImperativeHandle(ref, () => ({
    refresh: () => explorerRef.current?.refresh(),
  }), []);

  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-inner">
        <div className="sidebar-header">
          <button
            className="sidebar-close-button"
            onClick={onClose}
            title="Close sidebar (⌘0)"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <FileExplorer
          ref={explorerRef}
          onFileSelect={onFileSelect}
          onCreateFile={onCreateFile}
        />
        <Settings />
      </div>
    </div>
  );
});
