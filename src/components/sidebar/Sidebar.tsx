import { FileExplorer } from "./FileExplorer";
import { Settings } from "./Settings";

interface SidebarProps {
  isOpen: boolean;
  onFileSelect: (path: string) => void;
  onCreateFile: (parentPath: string, name: string) => Promise<string | null>;
}

export function Sidebar({ isOpen, onFileSelect, onCreateFile }: SidebarProps) {
  return (
    <div className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-inner">
        <FileExplorer onFileSelect={onFileSelect} onCreateFile={onCreateFile} />
        <Settings />
      </div>
    </div>
  );
}
