import { useState, useCallback } from "react";
import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import {
  Sparkles,
  SpellCheck,
  Shrink,
  Expand,
  Lightbulb,
  Briefcase,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface AiBubbleMenuProps {
  editor: Editor;
}

interface AiResult {
  text: string;
}

const AI_ACTIONS = [
  { label: "Improve writing", instruction: "Improve the clarity, flow, and quality of this text while preserving its meaning.", icon: Sparkles },
  { label: "Fix grammar", instruction: "Fix all grammar, spelling, and punctuation errors in this text. Keep the meaning and style the same.", icon: SpellCheck },
  { label: "Make shorter", instruction: "Make this text more concise without losing important information.", icon: Shrink },
  { label: "Make longer", instruction: "Expand this text with more detail and depth while maintaining the same tone and style.", icon: Expand },
  { label: "Simplify", instruction: "Rewrite this text in simpler, more accessible language.", icon: Lightbulb },
  { label: "Professional tone", instruction: "Rewrite this text in a professional, formal tone suitable for business communication.", icon: Briefcase },
] as const;

export function AiBubbleMenu({ editor }: AiBubbleMenuProps) {
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback(
    async (instruction: string) => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, "\n");
      if (!selectedText.trim()) return;

      setLoading(true);
      setError(null);

      try {
        const result = await invoke<AiResult>("ai_generate", {
          instruction,
          selectedText,
        });

        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.replaceWith(from, to, editor.state.schema.text(result.text));
            return true;
          })
          .run();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("AI error:", e);
        setError(msg);
      } finally {
        setLoading(false);
        setShowCustom(false);
        setCustomPrompt("");
      }
    },
    [editor],
  );

  const handleCustomSubmit = useCallback(() => {
    if (customPrompt.trim()) {
      runAction(customPrompt.trim());
    }
  }, [customPrompt, runAction]);

  const handleCustomKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleCustomSubmit();
      }
      if (e.key === "Escape") {
        setShowCustom(false);
        setCustomPrompt("");
      }
    },
    [handleCustomSubmit],
  );

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        placement: "bottom-start",
        duration: 150,
        maxWidth: "none",
      }}
      shouldShow={({ editor: e, state }) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        if (e.isActive("codeBlock")) return false;
        return true;
      }}
    >
      <div className="ai-bubble-menu">
        {loading ? (
          <div className="ai-bubble-loading">
            <Loader2 size={14} className="ai-spinner" />
            <span>Generating…</span>
          </div>
        ) : error ? (
          <div className="ai-bubble-error">
            <span className="ai-error-text">{error}</span>
            <button
              className="ai-error-dismiss"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : showCustom ? (
          <div className="ai-bubble-custom">
            <input
              className="ai-custom-input"
              type="text"
              placeholder="Tell AI what to do…"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              autoFocus
            />
            <button
              className="ai-custom-submit"
              onClick={handleCustomSubmit}
              disabled={!customPrompt.trim()}
            >
              <Sparkles size={14} />
            </button>
          </div>
        ) : (
          <div className="ai-bubble-actions">
            {AI_ACTIONS.map((action) => (
              <button
                key={action.label}
                className="ai-action-button"
                onClick={() => runAction(action.instruction)}
              >
                <action.icon size={14} />
                <span>{action.label}</span>
              </button>
            ))}
            <div className="ai-bubble-divider" />
            <button
              className="ai-action-button"
              onClick={() => setShowCustom(true)}
            >
              <MessageSquare size={14} />
              <span>Custom prompt…</span>
            </button>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
