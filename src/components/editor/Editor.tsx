import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
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

export function Editor() {
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const versionRef = useRef(0);
  const countedVersionRef = useRef(0);

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
      CharacterCount,
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
    onUpdate: ({ editor }) => {
      versionRef.current += 1;
      setIsStale(true);
      setError(null);
      setWordCount(editor.storage.characterCount.words());
      setCharCount(editor.storage.characterCount.characters());
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

  return (
    <div className="editor-container">
      {editor && <Toolbar editor={editor} />}
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
