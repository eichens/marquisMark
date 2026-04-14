import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const PLUGIN_KEY = new PluginKey("xmlTagAutoClose");

/**
 * Matches an opening XML tag being typed: `<tagname` at the end of text.
 * Captures the tag name. Allows letters, digits, underscores, hyphens, colons.
 */
const OPENING_TAG_PATTERN = /<([\w][\w:-]*)$/;

/**
 * Detects if the tag starts at the beginning of the paragraph (after optional whitespace).
 * Used to decide between block expansion vs inline close.
 */
const LINE_START_TAG_PATTERN = /^(\s*)<([\w][\w:-]*)$/;

function getLeadingWhitespace(text: string): string {
  return text.match(/^(\s*)/)?.[1] || "";
}

function handleAutoClose(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const { state } = view;
  const { $from } = state.selection;
  const paragraph = $from.parent;

  if (paragraph.type.name !== "paragraph") return false;

  const textBefore = paragraph.textBetween(0, $from.parentOffset);
  const tagMatch = textBefore.match(OPENING_TAG_PATTERN);
  if (!tagMatch) return false;

  const tagName = tagMatch[1];
  const lineStartMatch = textBefore.match(LINE_START_TAG_PATTERN);
  const { tr, schema } = state;
  const paragraphType = schema.nodes.paragraph;

  if (lineStartMatch) {
    // Block expansion: tag is at line start
    // <tagname>
    //   |cursor
    // </tagname>
    const currentIndent = lineStartMatch[1];
    const contentIndent = currentIndent + "  ";

    // Insert the '>'
    tr.insertText(">", from, to);

    // Position after the current paragraph
    const afterParagraph = tr.mapping.map($from.after());

    // Create content paragraph (indented) and closing tag paragraph
    const contentPara = paragraphType.create(
      null,
      contentIndent ? [schema.text(contentIndent)] : undefined,
    );
    const closingPara = paragraphType.create(null, [
      schema.text(`${currentIndent}</${tagName}>`),
    ]);

    tr.insert(afterParagraph, [contentPara, closingPara]);

    // Place cursor at end of content paragraph's indentation
    // afterParagraph -> start of contentPara node
    // +1 -> inside contentPara
    // +contentIndent.length -> after the whitespace
    const cursorPos = afterParagraph + 1 + contentIndent.length;
    tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  } else {
    // Inline close: tag is in the middle of text
    // <tagname>|cursor|</tagname>

    // Insert '>' and the closing tag
    const closingTag = `</${tagName}>`;
    tr.insertText(">" + closingTag, from, to);

    // Place cursor right after the '>' (between open and close tags)
    // from was where '>' goes. After inserting ">closingTag",
    // the cursor should be at from + 1 (right after '>').
    const cursorPos = from + 1;
    tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  }

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
            return false;
          },
        },
      }),
    ];
  },
});
