import { Node, mergeAttributes } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

/**
 * Custom node for non-HTML XML blocks rendered as `<pre data-xml-block="true">`.
 *
 * Dual source of truth: text children (so the cursor and editing work) AND the
 * `rawContent` attribute (the source used by the markdown serializer). The
 * appendTransaction plugin below keeps `rawContent` in sync with `textContent`
 * on every doc change — do not read from textContent during serialization.
 */
export const XmlBlock = Node.create({
  name: "xmlBlock",
  group: "block",
  content: "text*",
  code: true,
  defining: true,

  addAttributes() {
    return {
      rawContent: { default: "" },
    };
  },

  parseHTML() {
    return [{
      tag: 'pre[data-xml-block="true"]',
      preserveWhitespace: "full" as const,
      priority: 60,
      getAttrs(node) {
        const el = node as HTMLElement;
        const code = el.querySelector("code");
        return { rawContent: code?.textContent ?? el.textContent ?? "" };
      },
      getContent(node, schema) {
        const el = node as HTMLElement;
        const code = el.querySelector("code");
        const text = code?.textContent ?? el.textContent ?? "";
        if (!text) return Fragment.empty;
        return Fragment.from(schema.text(text));
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes, { "data-xml-block": "true" }),
      ["code", { class: "language-xml" }, 0],
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (!editor.isActive("xmlBlock")) return false;
        editor.commands.command(({ tr, state }) => {
          const { $from } = state.selection;
          // Carry leading whitespace from the current line. If the line has
          // none (e.g. user backspaced the indent away), the new line stays
          // unindented — auto-indent doesn't fight a deliberate dedent.
          const before = $from.parent.textBetween(0, $from.parentOffset);
          const lineStart = before.lastIndexOf("\n") + 1;
          const indent = before.slice(lineStart).match(/^[ \t]*/)?.[0] ?? "";
          const insertText = "\n" + indent;
          tr.insertText(insertText, $from.pos);
          tr.setSelection(TextSelection.create(tr.doc, $from.pos + insertText.length));
          return true;
        });
        return true;
      },
      "Shift-Enter": ({ editor }) => {
        if (!editor.isActive("xmlBlock")) return false;
        return editor.commands.exitCode();
      },
    };
  },

  addProseMirrorPlugins() {
    const nodeType = this.type;
    return [
      new Plugin({
        key: new PluginKey("xmlBlockSync"),
        appendTransaction(transactions, _oldState, newState) {
          let modified = false;
          for (const tr of transactions) {
            if (tr.docChanged) { modified = true; break; }
          }
          if (!modified) return null;
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type !== nodeType) return;
            const text = node.textContent;
            if (node.attrs.rawContent !== text) {
              tr.setNodeAttribute(pos, "rawContent", text);
              changed = true;
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});
