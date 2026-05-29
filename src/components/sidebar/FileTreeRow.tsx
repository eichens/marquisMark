import { ChevronRight, ChevronDown, Folder } from "lucide-react";
import { FileIcon } from "./FileIcon";

export interface VisibleRow {
  name: string;
  path: string;
  isDir: boolean;
  depth: number;
  expanded: boolean;
  loading: boolean;
  openable: boolean;
}

interface FileTreeRowProps {
  row: VisibleRow;
  onActivate: (row: VisibleRow) => void;
}

export function FileTreeRow({ row, onActivate }: FileTreeRowProps) {
  const iconSize = 14;
  const classes = [
    "file-tree-node",
    row.isDir ? "directory" : "file",
    row.openable ? "" : "disabled",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ paddingLeft: `${row.depth + 0.5}rem` }}
      onClick={() => onActivate(row)}
    >
      {row.isDir ? (
        row.expanded ? (
          <ChevronDown size={iconSize} className="tree-chevron" />
        ) : (
          <ChevronRight size={iconSize} className="tree-chevron" />
        )
      ) : (
        <span className="tree-chevron-spacer" />
      )}
      {row.isDir ? (
        <Folder size={iconSize} />
      ) : (
        <FileIcon name={row.name} size={iconSize} />
      )}
      <span className="tree-node-name">{row.name}</span>
    </div>
  );
}
