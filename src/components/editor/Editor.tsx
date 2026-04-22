import { useState, useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import SuperscriptExt from "@tiptap/extension-superscript";
import SubscriptExt from "@tiptap/extension-subscript";
import TextAlign from "@tiptap/extension-text-align";
import ImageExt from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { common, createLowlight } from "lowlight";
import { RefreshCw, Copy, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { XmlTagHighlighter } from "../../extensions/XmlTagHighlighter";
import { XmlTagAutoClose } from "../../extensions/XmlTagAutoClose";
import { serializeToMarkdown } from "../../services/markdownSerializer";
import { Toolbar } from "./Toolbar";
import { SpellcheckMenu } from "./SpellcheckMenu";
import { Spellcheck } from "../../extensions/Spellcheck";
import { AiBubbleMenu } from "./AiBubbleMenu";

const lowlight = createLowlight(common);

interface TokenCountResult {
  input_tokens: number;
}

interface FileContents {
  content: string;
  path: string;
}

const MD_FILTERS = [{ name: "Markdown", extensions: ["md", "mdx", "markdown", "txt"] }];

function countFromDoc(doc: import("@tiptap/pm/model").Node) {
  const text = doc.textBetween(0, doc.content.size, " ", " ");
  const chars = doc.textBetween(0, doc.content.size, undefined, " ").length;
  const words = text.split(" ").filter(w => w !== "").length;
  return { chars, words };
}

export function Editor() {
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const versionRef = useRef(0);
  const countedVersionRef = useRef(0);
  const savedVersionRef = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder: "Start writing your prompt…",
      }),
      Link.configure({
        openOnClick: false,
      }),
      Underline,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight,
      SuperscriptExt,
      SubscriptExt,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      ImageExt.configure({
        inline: false,
      }),
      TextStyle,
      Color,
      XmlTagHighlighter,
      XmlTagAutoClose,
      Spellcheck,
    ],
    content: "",
    autofocus: true,
    editorProps: {
      attributes: {
        spellcheck: "false",
      },
    },
    onCreate: ({ editor }) => {
      const c = countFromDoc(editor.state.doc);
      setWordCount(c.words);
      setCharCount(c.chars);
    },
    onUpdate: ({ editor }) => {
      versionRef.current += 1;
      setIsStale(true);
      setError(null);
      setIsDirty(versionRef.current !== savedVersionRef.current);
      const c = countFromDoc(editor.state.doc);
      setWordCount(c.words);
      setCharCount(c.chars);
    },
  });

  const handleCopy = useCallback(async () => {
    if (!editor) return;
    const markdown = serializeToMarkdown(editor);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [editor]);

  const handleCountTokens = useCallback(async () => {
    if (!editor || isLoading) return;

    const markdown = serializeToMarkdown(editor);
    if (!markdown.trim()) {
      setTokenCount(0);
      setIsStale(false);
      countedVersionRef.current = versionRef.current;
      return;
    }

    setIsLoading(true);
    setError(null);

    const requestVersion = versionRef.current;

    try {
      const result = await invoke<TokenCountResult>("count_tokens", {
        content: markdown,
      });
      setTokenCount(result.input_tokens);
      countedVersionRef.current = requestVersion;
      setIsStale(requestVersion !== versionRef.current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Token count error:", e);
      setError(msg);
      setIsStale(true);
    } finally {
      setIsLoading(false);
    }
  }, [editor, isLoading]);

  const handleOpenFile = useCallback(async () => {
    if (!editor) return;
    const selected = await open({ multiple: false, filters: MD_FILTERS });
    if (!selected) return;
    try {
      const result = await invoke<FileContents>("read_file", { path: selected });
      editor.commands.setContent(result.content);
      setCurrentFilePath(result.path);
      const c = countFromDoc(editor.state.doc);
      setWordCount(c.words);
      setCharCount(c.chars);
      savedVersionRef.current = versionRef.current;
      setIsDirty(false);
    } catch (e) {
      console.error("Open file error:", e);
      setError(String(e));
    }
  }, [editor]);

  const handleSaveFile = useCallback(async () => {
    if (!editor) return;
    const markdown = serializeToMarkdown(editor);
    let filePath = currentFilePath;
    if (!filePath) {
      const selected = await save({ filters: MD_FILTERS, defaultPath: "untitled.md" });
      if (!selected) return;
      filePath = selected;
    }
    try {
      await invoke("write_file", { path: filePath, content: markdown });
      setCurrentFilePath(filePath);
      savedVersionRef.current = versionRef.current;
      setIsDirty(false);
    } catch (e) {
      console.error("Save file error:", e);
      setError(String(e));
    }
  }, [editor, currentFilePath]);

  const handleSaveAs = useCallback(async () => {
    if (!editor) return;
    const markdown = serializeToMarkdown(editor);
    const selected = await save({ filters: MD_FILTERS, defaultPath: currentFilePath || "untitled.md" });
    if (!selected) return;
    try {
      await invoke("write_file", { path: selected, content: markdown });
      setCurrentFilePath(selected);
      savedVersionRef.current = versionRef.current;
      setIsDirty(false);
    } catch (e) {
      console.error("Save as error:", e);
      setError(String(e));
    }
  }, [editor, currentFilePath]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      } else if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault();
        handleSaveAs();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        handleSaveFile();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenFile, handleSaveFile, handleSaveAs]);

  return (
    <div className="editor-container">
      {editor && (
        <Toolbar
          editor={editor}
          onOpen={handleOpenFile}
          onSave={handleSaveFile}
        />
      )}
      {editor && <SpellcheckMenu editor={editor} />}
      {editor && <AiBubbleMenu editor={editor} />}
      <div className="editor-scroll-area">
        <div className="editor-content-wrapper">
          <EditorContent editor={editor} />
          <button
            className={`copy-button ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title="Copy as markdown"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      {editor && (
        <div className="status-bar">
          <span className="status-bar-file">
            {currentFilePath
              ? currentFilePath.split("/").pop()
              : "Untitled"}
            {isDirty ? " •" : ""}
          </span>
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          <span className="status-bar-spacer" />
          <span className="token-count-section">
            {error ? (
              <span className="token-count-error">
                {error}
              </span>
            ) : isStale || tokenCount === null ? (
              <button
                className={`sync-button ${isLoading ? "spinning" : ""}`}
                onClick={handleCountTokens}
                disabled={isLoading}
                title="Count tokens"
              >
                <RefreshCw size={12} />
                {tokenCount !== null && (
                  <span className="token-count-stale">
                    {tokenCount.toLocaleString()} tokens
                  </span>
                )}
              </button>
            ) : (
              <span className="token-count-fresh">
                {tokenCount.toLocaleString()} tokens
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
