import { File, FileText } from "lucide-react";

interface FileIconProps {
  name: string;
  size?: number;
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot + 1).toLowerCase();
}

// Official Markdown mark (https://github.com/dcurtis/markdown-mark, CC0).
// Inlined so we don't pull a whole icon pack for one glyph; uses currentColor
// so it inherits the row's text color (hover / disabled states "just work").
function MarkdownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 208 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="file-icon-md"
    >
      <rect
        x="1.5"
        y="1.5"
        width="205"
        height="125"
        rx="14"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39H30zm125 0L125 65h20V30h20v35h20l-30 33z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FileIcon({ name, size = 14 }: FileIconProps) {
  const ext = getExtension(name);
  if (ext === "md" || ext === "mdx" || ext === "markdown") {
    return <MarkdownIcon size={size} />;
  }
  if (ext === "txt") {
    return <FileText size={size} />;
  }
  return <File size={size} />;
}
