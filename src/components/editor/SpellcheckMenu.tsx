import { useState, useEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { triggerRescan } from "../../extensions/Spellcheck";
import { ignoreWord } from "../../services/spellcheck";

interface MenuState {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
  x: number;
  y: number;
}

interface SpellcheckMenuProps {
  editor: Editor;
}

export function SpellcheckMenu({ editor }: SpellcheckMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleContext(e: Event) {
      setMenu((e as CustomEvent).detail as MenuState);
    }
    window.addEventListener("spellcheck-context", handleContext);
    return () => window.removeEventListener("spellcheck-context", handleContext);
  }, []);

  // Close on outside click or scroll
  useEffect(() => {
    if (!menu) return;
    function close(e: Event) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    }
    function scrollClose() {
      setMenu(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", scrollClose, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", scrollClose, true);
    };
  }, [menu]);

  // Close on Escape
  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const replace = useCallback(
    (replacement: string) => {
      if (!menu) return;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.replaceWith(
            menu.from,
            menu.to,
            editor.state.schema.text(replacement),
          );
          return true;
        })
        .run();
      setMenu(null);
    },
    [editor, menu],
  );

  const handleIgnore = useCallback(() => {
    if (!menu) return;
    ignoreWord(menu.word);
    triggerRescan(editor.view);
    setMenu(null);
  }, [editor, menu]);

  const handleIgnoreAll = useCallback(() => {
    if (!menu) return;
    ignoreWord(menu.word);
    triggerRescan(editor.view);
    setMenu(null);
  }, [editor, menu]);

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="spellcheck-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.suggestions.length > 0 ? (
        <div className="spellcheck-suggestions">
          {menu.suggestions.map((s) => (
            <button
              key={s}
              className="spellcheck-suggestion"
              onClick={() => replace(s)}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="spellcheck-no-suggestions">No suggestions</div>
      )}
      <div className="spellcheck-menu-divider" />
      <div className="spellcheck-actions">
        <button className="spellcheck-action" onClick={handleIgnore}>
          Ignore
        </button>
        <button className="spellcheck-action" onClick={handleIgnoreAll}>
          Ignore All
        </button>
      </div>
    </div>
  );
}
