import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Serializes the TipTap editor document back to raw markdown text.
 * Walks the ProseMirror document tree and emits markdown syntax.
 */
export function serializeToMarkdown(editor: Editor): string {
  const doc = editor.state.doc;
  const lines: string[] = [];
  serializeNode(doc, lines, "");
  return lines.join("\n");
}

function serializeNode(
  node: ProseMirrorNode,
  lines: string[],
  _indent: string,
): void {
  if (node.type.name === "doc") {
    let first = true;
    node.forEach((child) => {
      if (!first) lines.push("");
      serializeNode(child, lines, _indent);
      first = false;
    });
    return;
  }

  if (node.type.name === "heading") {
    const level = node.attrs.level as number;
    const prefix = "#".repeat(level) + " ";
    lines.push(prefix + serializeInline(node));
    return;
  }

  if (node.type.name === "paragraph") {
    lines.push(serializeInline(node));
    return;
  }

  if (node.type.name === "bulletList") {
    node.forEach((child) => serializeBulletItem(child, lines, _indent));
    return;
  }

  if (node.type.name === "orderedList") {
    let index = (node.attrs.start as number) || 1;
    node.forEach((child) => {
      serializeOrderedItem(child, lines, _indent, index);
      index++;
    });
    return;
  }

  if (node.type.name === "taskList") {
    node.forEach((child) => serializeTaskItem(child, lines, _indent));
    return;
  }

  if (node.type.name === "blockquote") {
    const subLines: string[] = [];
    node.forEach((child) => serializeNode(child, subLines, _indent));
    subLines.forEach((line) => lines.push("> " + line));
    return;
  }

  if (node.type.name === "xmlBlock") {
    const raw = node.attrs.rawContent as string;
    if (raw) {
      lines.push(raw);
    } else {
      lines.push(node.textContent);
    }
    return;
  }

  if (node.type.name === "codeBlock") {
    const lang = (node.attrs.language as string) || "";
    lines.push("```" + lang);
    lines.push(node.textContent);
    lines.push("```");
    return;
  }

  if (node.type.name === "image") {
    const src = (node.attrs.src as string) || "";
    const alt = (node.attrs.alt as string) || "";
    lines.push(`![${alt}](${src})`);
    return;
  }

  if (node.type.name === "horizontalRule") {
    lines.push("---");
    return;
  }

  if (node.type.name === "hardBreak") {
    // Append to previous line
    return;
  }

  // Fallback: serialize as text
  if (node.isBlock) {
    lines.push(node.textContent);
  }
}

function serializeBulletItem(
  node: ProseMirrorNode,
  lines: string[],
  indent: string,
): void {
  let first = true;
  node.forEach((child) => {
    if (first) {
      if (child.type.name === "paragraph") {
        lines.push(indent + "- " + serializeInline(child));
      } else {
        const subLines: string[] = [];
        serializeNode(child, subLines, indent + "  ");
        lines.push(indent + "- " + (subLines[0] || "").trimStart());
        subLines.slice(1).forEach((l) => lines.push(l));
      }
      first = false;
    } else {
      serializeNode(child, lines, indent + "  ");
    }
  });
}

function serializeOrderedItem(
  node: ProseMirrorNode,
  lines: string[],
  indent: string,
  index: number,
): void {
  const prefix = `${index}. `;
  const continuation = " ".repeat(prefix.length);
  let first = true;
  node.forEach((child) => {
    if (first) {
      if (child.type.name === "paragraph") {
        lines.push(indent + prefix + serializeInline(child));
      } else {
        const subLines: string[] = [];
        serializeNode(child, subLines, indent + continuation);
        lines.push(indent + prefix + (subLines[0] || "").trimStart());
        subLines.slice(1).forEach((l) => lines.push(l));
      }
      first = false;
    } else {
      serializeNode(child, lines, indent + continuation);
    }
  });
}

function serializeTaskItem(
  node: ProseMirrorNode,
  lines: string[],
  indent: string,
): void {
  const checked = node.attrs.checked as boolean;
  const checkbox = checked ? "- [x] " : "- [ ] ";
  let first = true;
  node.forEach((child) => {
    if (first) {
      if (child.type.name === "paragraph") {
        lines.push(indent + checkbox + serializeInline(child));
      } else {
        const subLines: string[] = [];
        serializeNode(child, subLines, indent + "      ");
        lines.push(indent + checkbox + (subLines[0] || "").trimStart());
        subLines.slice(1).forEach((l) => lines.push(l));
      }
      first = false;
    } else {
      serializeNode(child, lines, indent + "      ");
    }
  });
}

function serializeInline(node: ProseMirrorNode): string {
  let result = "";

  node.forEach((child) => {
    if (child.type.name === "hardBreak") {
      result += "  \n";
      return;
    }

    if (!child.isText || !child.text) return;

    let text = child.text;

    // Apply marks in correct order
    const marks = child.marks || [];

    // Check each mark and wrap accordingly
    const hasCode = marks.some((m) => m.type.name === "code");
    if (hasCode) {
      // Code mark — don't apply other formatting inside it
      result += "`" + text + "`";
      return;
    }

    const hasBold = marks.some((m) => m.type.name === "bold");
    const hasItalic = marks.some((m) => m.type.name === "italic");
    const hasStrike = marks.some((m) => m.type.name === "strike");
    const hasUnderline = marks.some((m) => m.type.name === "underline");
    const hasHighlight = marks.some((m) => m.type.name === "highlight");
    const hasSuperscript = marks.some((m) => m.type.name === "superscript");
    const hasSubscript = marks.some((m) => m.type.name === "subscript");
    const linkMark = marks.find((m) => m.type.name === "link");

    if (hasStrike) text = "~~" + text + "~~";
    if (hasBold && hasItalic) text = "***" + text + "***";
    else if (hasBold) text = "**" + text + "**";
    else if (hasItalic) text = "*" + text + "*";
    if (hasHighlight) text = "==" + text + "==";
    if (hasUnderline) text = "<u>" + text + "</u>";
    if (hasSuperscript) text = "<sup>" + text + "</sup>";
    if (hasSubscript) text = "<sub>" + text + "</sub>";
    if (linkMark) text = "[" + text + "](" + linkMark.attrs.href + ")";

    result += text;
  });

  return result;
}
