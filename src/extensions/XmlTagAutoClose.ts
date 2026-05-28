import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const PLUGIN_KEY = new PluginKey("xmlTagAutoClose");

const OPENING_TAG_PATTERN = /<([\w][\w:-]*)[^>]*$/;

function getLeadingWhitespace(text: string): string {
  return text.match(/^(\s*)/)?.[1] || "";
}

function handleAutoCloseInXmlBlock(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const { state } = view;
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name !== "xmlBlock") return false;

  const textBefore = parent.textBetween(0, $from.parentOffset);
  const tagMatch = textBefore.match(OPENING_TAG_PATTERN);
  if (!tagMatch) return false;

  const tagName = tagMatch[1];
  const closingTag = `</${tagName}>`;
  const { tr } = state;

  tr.insertText(">" + closingTag, from, to);
  tr.setSelection(TextSelection.create(tr.doc, from + 1));

  view.dispatch(tr);
  return true;
}

function handleAutoClose(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const { state } = view;
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name === "xmlBlock") {
    return handleAutoCloseInXmlBlock(view, from, to);
  }

  if (paragraph.type.name !== "paragraph") return false;

  const textBefore = paragraph.textBetween(0, $from.parentOffset);
  const tagMatch = textBefore.match(OPENING_TAG_PATTERN);
  if (!tagMatch) return false;

  const tagName = tagMatch[1];
  const { tr } = state;
  const closingTag = `</${tagName}>`;

  tr.insertText(">" + closingTag, from, to);
  tr.setSelection(TextSelection.create(tr.doc, from + 1));

  view.dispatch(tr);
  return true;
}

const INDENT = "  ";

function handleTab(view: EditorView): boolean {
  const { state } = view;
  const { $from } = state.selection;
  const parent = $from.parent;

  // Defer to TipTap's list-sink behavior when inside a list. Returning false
  // lets the chained keymap handler run.
  if (
    parent.type.name === "listItem" ||
    parent.type.name === "taskItem" ||
    parent.type.name === "bulletList" ||
    parent.type.name === "orderedList" ||
    parent.type.name === "taskList"
  ) {
    return false;
  }

  const { tr } = state;
  tr.insertText(INDENT, state.selection.from, state.selection.to);
  view.dispatch(tr);
  return true;
}

function handleShiftTab(view: EditorView): boolean {
  const { state } = view;
  const { $from } = state.selection;
  const parent = $from.parent;

  if (
    parent.type.name === "listItem" ||
    parent.type.name === "taskItem" ||
    parent.type.name === "bulletList" ||
    parent.type.name === "orderedList" ||
    parent.type.name === "taskList"
  ) {
    return false;
  }

  // Remove up to 2 leading whitespace characters from the start of the line
  // (the current paragraph or xmlBlock line). If there isn't any, swallow the
  // event so focus doesn't escape the editor.
  const lineStart = $from.start();
  const before = parent.textBetween(0, $from.parentOffset);
  const leading = before.match(/^( {1,2})/)?.[1];
  if (!leading) return true;

  const { tr } = state;
  tr.delete(lineStart, lineStart + leading.length);
  view.dispatch(tr);
  return true;
}

function handleEnterIndent(view: EditorView): boolean {
  const { state } = view;
  const { $from, empty } = state.selection;

  if (!empty) return false;

  const paragraph = $from.parent;
  if (paragraph.type.name !== "paragraph") return false;

  const textContent = paragraph.textContent;
  const leadingWhitespace = getLeadingWhitespace(textContent);

  // If no indentation, let default behavior handle it
  if (!leadingWhitespace) return false;

  const { tr, schema } = state;
  const paragraphType = schema.nodes.paragraph;

  // Split at cursor position, creating a new paragraph with preserved indentation
  const afterParagraph = $from.after();

  // Get text after cursor in the current paragraph
  const textAfterCursor = paragraph.textBetween(
    $from.parentOffset,
    paragraph.content.size,
  );

  // Delete text after cursor from current paragraph
  const deleteFrom = $from.pos;
  const deleteTo = $from.end();
  if (deleteFrom < deleteTo) {
    tr.delete(deleteFrom, deleteTo);
  }

  // Insert new paragraph with indentation + remaining text
  const newText = leadingWhitespace + textAfterCursor;
  const newPara = paragraphType.create(
    null,
    newText ? [schema.text(newText)] : undefined,
  );

  const insertPos = tr.mapping.map(afterParagraph);
  tr.insert(insertPos, newPara);

  // Place cursor after the indentation in the new paragraph
  const cursorPos = insertPos + 1 + leadingWhitespace.length;
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));

  view.dispatch(tr);
  return true;
}

export const XmlTagAutoClose = Extension.create({
  name: "xmlTagAutoClose",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLUGIN_KEY,
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== ">") return false;
            return handleAutoClose(view, from, to);
          },
          handleKeyDown(view, event) {
            if (event.key === "Enter" && !event.shiftKey) {
              return handleEnterIndent(view);
            }
            if (event.key === "Tab" && !event.shiftKey) {
              return handleTab(view);
            }
            if (event.key === "Tab" && event.shiftKey) {
              return handleShiftTab(view);
            }
            return false;
          },
        },
      }),
    ];
  },
});
