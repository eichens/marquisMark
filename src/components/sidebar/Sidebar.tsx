import { ChevronLeft } from "lucide-react";
import { FileExplorer } from "./FileExplorer";
import { Settings } from "./Settings";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCreateFile: (parentPath: string, name: string) => Promise<string | null>;
}

export function Sidebar({ isOpen, onClose, onFileSelect, onCreateFile }: SidebarProps) {
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
        <FileExplorer onFileSelect={onFileSelect} onCreateFile={onCreateFile} />
        <Settings />
      </div>
    </div>
  );
}
