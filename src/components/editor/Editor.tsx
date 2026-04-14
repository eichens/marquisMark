import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
import { XmlTagHighlighter } from "../../extensions/XmlTagHighlighter";
import { XmlTagAutoClose } from "../../extensions/XmlTagAutoClose";

export function Editor() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Placeholder.configure({
        placeholder: "Start writing your prompt…",
      }),
      Link.configure({
        openOnClick: false,
      }),
      Underline,
      CharacterCount,
      XmlTagHighlighter,
      XmlTagAutoClose,
    ],
    content: "",
    autofocus: true,
  });

  return (
    <div className="editor-container">
      <EditorContent editor={editor} />
      {editor && (
        <div className="status-bar">
          <span>{editor.storage.characterCount.words()} words</span>
          <span>{editor.storage.characterCount.characters()} characters</span>
        </div>
      )}
    </div>
  );
}
