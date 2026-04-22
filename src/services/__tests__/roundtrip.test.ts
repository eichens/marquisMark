// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseMarkdownToHtml } from "../markdownParser";
import { serializeToMarkdown } from "../markdownSerializer";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { XmlBlock } from "../../extensions/XmlBlock";

function createEditor(html: string): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [
      StarterKit,
      XmlBlock,
    ],
    content: html,
  });
  return editor;
}

describe("round-trip", () => {
  it("mixed-xml.md round-trips without diff", () => {
    const fixturePath = resolve(__dirname, "../../../test-fixtures/mixed-xml.md");
    const original = readFileSync(fixturePath, "utf-8");
    const html = parseMarkdownToHtml(original);
    const editor = createEditor(html);
    const serialized = serializeToMarkdown(editor);
    editor.destroy();
    expect(serialized.trimEnd()).toBe(original.trimEnd());
  });

  it("HTML div passes through and round-trips", () => {
    const md = '<div class="foo">hello</div>\n';
    const html = parseMarkdownToHtml(md);
    expect(html).toContain('<div class="foo">hello</div>');
    expect(html).not.toContain("data-xml-block");
  });

  it("fenced code block is not confused with XML path", () => {
    const md = "```xml\n<not-a-block>test</not-a-block>\n```\n";
    const html = parseMarkdownToHtml(md);
    const editor = createEditor(html);
    const serialized = serializeToMarkdown(editor);
    editor.destroy();
    expect(html).not.toContain("data-xml-block");
    expect(serialized).toContain("```");
    expect(serialized).toContain("<not-a-block>test</not-a-block>");
  });

  it("inline custom tag is preserved", () => {
    const md = "this has <custom-tag/> inline\n";
    const html = parseMarkdownToHtml(md);
    expect(html).toContain("<custom-tag/>");
    expect(html).not.toContain("data-xml-block");
  });

  it("documents block with source child is treated as XML, not HTML", () => {
    const md = "<documents>\n<source>file.txt</source>\n</documents>\n";
    const html = parseMarkdownToHtml(md);
    expect(html).toContain('data-xml-block="true"');
    expect(html).toContain("&lt;source&gt;");
  });

  it("XML block with blank lines stays as one block", () => {
    const md = "<documents>\n\n<document index=\"1\">\n<source>notes.txt</source>\n</document>\n\n</documents>\n";
    const html = parseMarkdownToHtml(md);
    const blockCount = (html.match(/data-xml-block/g) || []).length;
    expect(blockCount).toBe(1);
    const editor = createEditor(html);
    const types: string[] = [];
    editor.state.doc.forEach((node) => types.push(node.type.name));
    expect(types.filter(t => t === "xmlBlock")).toHaveLength(1);
    const serialized = serializeToMarkdown(editor);
    editor.destroy();
    expect(serialized.trimEnd()).toBe(md.trimEnd());
  });

  it("XML block round-trips alongside headers and paragraphs", () => {
    const md = "## Header\n\n<documents>\n<document index=\"1\">\ncontent\n</document>\n</documents>\n\nFinal text.\n";
    const html = parseMarkdownToHtml(md);
    const editor = createEditor(html);
    const serialized = serializeToMarkdown(editor);
    editor.destroy();
    expect(serialized.trimEnd()).toBe(md.trimEnd());
  });
});
