import { useState, useCallback, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Heading,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  CodeXml,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Link,
  Superscript,
  Subscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  ChevronDown,
  Baseline,
} from "lucide-react";

interface ToolbarProps {
  editor: Editor;
  onOpen: () => void;
  onSave: () => void;
}

interface DropdownPos {
  top: number;
  left: number;
}

const TEXT_COLORS = [
  { name: "Default", color: null },
  { name: "Red", color: "#ef4444" },
  { name: "Orange", color: "#f97316" },
  { name: "Amber", color: "#f59e0b" },
  { name: "Green", color: "#22c55e" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Indigo", color: "#6366f1" },
  { name: "Purple", color: "#a855f7" },
  { name: "Pink", color: "#ec4899" },
  { name: "Gray", color: "#6b7280" },
];

/** Compute fixed position below a trigger element. */
function posBelow(el: HTMLElement): DropdownPos {
  const rect = el.getBoundingClientRect();
  return { top: rect.bottom + 4, left: rect.left };
}

export function Toolbar({ editor, onOpen, onSave }: ToolbarProps) {
  const [headingOpen, setHeadingOpen] = useState(false);
  const [headingPos, setHeadingPos] = useState<DropdownPos | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState<DropdownPos | null>(null);

  const headingTriggerRef = useRef<HTMLButtonElement>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        headingOpen &&
        headingMenuRef.current &&
        !headingMenuRef.current.contains(e.target as Node) &&
        headingTriggerRef.current &&
        !headingTriggerRef.current.contains(e.target as Node)
      ) {
        setHeadingOpen(false);
      }
      if (
        colorOpen &&
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target as Node) &&
        colorTriggerRef.current &&
        !colorTriggerRef.current.contains(e.target as Node)
      ) {
        setColorOpen(false);
      }
    }
    if (headingOpen || colorOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [headingOpen, colorOpen]);

  const toggleHeading = () => {
    if (!headingOpen && headingTriggerRef.current) {
      setHeadingPos(posBelow(headingTriggerRef.current));
    }
    setHeadingOpen(!headingOpen);
    setColorOpen(false);
  };

  const toggleColor = () => {
    if (!colorOpen && colorTriggerRef.current) {
      setColorPos(posBelow(colorTriggerRef.current));
    }
    setColorOpen(!colorOpen);
    setHeadingOpen(false);
  };

  const getHeadingLabel = () => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive("heading", { level: i })) return `H${i}`;
    }
    return "H";
  };

  const setLink = useCallback(() => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const iconSize = 16;

  return (
    <div className="editor-toolbar">
      {/* File operations */}
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={onOpen}
          title="Open file (⌘O)"
        >
          <FolderOpen size={iconSize} />
        </button>
        <button
          className="toolbar-button"
          onClick={onSave}
          title="Save file (⌘S)"
        >
          <Save size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 size={iconSize} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Section 2: Heading, List, Blockquote, Code block */}
      <div className="toolbar-group">
        <button
          ref={headingTriggerRef}
          className={`toolbar-button toolbar-dropdown-trigger ${
            editor.isActive("heading") ? "is-active" : ""
          }`}
          onClick={toggleHeading}
          title="Heading"
        >
          <Heading size={iconSize} />
          <span className="toolbar-heading-label">{getHeadingLabel()}</span>
          <ChevronDown size={10} />
        </button>
        {headingOpen && headingPos && (
          <div
            ref={headingMenuRef}
            className="toolbar-dropdown-menu"
            style={{ top: headingPos.top, left: headingPos.left }}
          >
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <button
                key={level}
                className={`toolbar-dropdown-item ${
                  editor.isActive("heading", { level }) ? "is-active" : ""
                }`}
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
                    .run();
                  setHeadingOpen(false);
                }}
              >
                <span className={`heading-preview h${level}`}>H{level}</span>
                <span>Heading {level}</span>
              </button>
            ))}
            <button
              className={`toolbar-dropdown-item ${
                !editor.isActive("heading") ? "is-active" : ""
              }`}
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                setHeadingOpen(false);
              }}
            >
              <span className="heading-preview">P</span>
              <span>Paragraph</span>
            </button>
          </div>
        )}
        <button
          className={`toolbar-button ${editor.isActive("bulletList") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("orderedList") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
        >
          <ListOrdered size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("taskList") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task list"
        >
          <ListChecks size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("blockquote") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <Quote size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("codeBlock") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          <CodeXml size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Section 3: Inline formatting */}
      <div className="toolbar-group">
        <button
          className={`toolbar-button ${editor.isActive("bold") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("italic") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("underline") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <Underline size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("strike") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("code") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          <Code size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive("highlight") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >
          <Highlighter size={iconSize} />
        </button>
        <button
          ref={colorTriggerRef}
          className={`toolbar-button toolbar-dropdown-trigger ${
            editor.getAttributes("textStyle").color ? "is-active" : ""
          }`}
          onClick={toggleColor}
          title="Text color"
        >
          <Baseline
            size={iconSize}
            style={{
              color:
                editor.getAttributes("textStyle").color || "var(--text-secondary)",
            }}
          />
          <ChevronDown size={10} />
        </button>
        {colorOpen && colorPos && (
          <div
            ref={colorMenuRef}
            className="toolbar-dropdown-menu toolbar-color-menu"
            style={{ top: colorPos.top, left: colorPos.left }}
          >
            {TEXT_COLORS.map((c) => (
              <button
                key={c.name}
                className={`toolbar-dropdown-item toolbar-color-item ${
                  c.color === null && !editor.getAttributes("textStyle").color
                    ? "is-active"
                    : editor.getAttributes("textStyle").color === c.color
                      ? "is-active"
                      : ""
                }`}
                onClick={() => {
                  if (c.color === null) {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(c.color).run();
                  }
                  setColorOpen(false);
                }}
              >
                <span
                  className="color-swatch"
                  style={{
                    background: c.color || "var(--text-primary)",
                  }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}
        <button
          className={`toolbar-button ${editor.isActive("link") ? "is-active" : ""}`}
          onClick={setLink}
          title="Link"
        >
          <Link size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Section 4: Superscript */}
      <div className="toolbar-group">
        <button
          className={`toolbar-button ${editor.isActive("superscript") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          title="Superscript"
        >
          <Superscript size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Section 5: Subscript */}
      <div className="toolbar-group">
        <button
          className={`toolbar-button ${editor.isActive("subscript") ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subscript"
        >
          <Subscript size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Section 6: Alignment */}
      <div className="toolbar-group">
        <button
          className={`toolbar-button ${editor.isActive({ textAlign: "left" }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align left"
        >
          <AlignLeft size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive({ textAlign: "center" }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align center"
        >
          <AlignCenter size={iconSize} />
        </button>
        <button
          className={`toolbar-button ${editor.isActive({ textAlign: "right" }) ? "is-active" : ""}`}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align right"
        >
          <AlignRight size={iconSize} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Section 7: Insert image */}
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={insertImage}
          title="Insert image"
        >
          <Image size={iconSize} />
        </button>
      </div>
    </div>
  );
}
