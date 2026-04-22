import { describe, it, expect } from "vitest";
import { parseMarkdownToHtml } from "../markdownParser";

describe("parseMarkdownToHtml", () => {
  it("wraps non-HTML XML blocks in pre[data-xml-block]", () => {
    const md = "<documents>\n<document index=\"1\">\ncontent\n</document>\n</documents>\n";
    const html = parseMarkdownToHtml(md);
    expect(html).toContain('data-xml-block="true"');
    expect(html).toContain("&lt;documents&gt;");
    expect(html).toContain("&lt;/documents&gt;");
  });

  it("passes through standard HTML tags as live HTML", () => {
    const md = '<div class="foo">hello</div>\n';
    const html = parseMarkdownToHtml(md);
    expect(html).toContain('<div class="foo">hello</div>');
    expect(html).not.toContain("data-xml-block");
  });

  it("does not interfere with fenced code blocks", () => {
    const md = "```xml\n<not-a-block>test</not-a-block>\n```\n";
    const html = parseMarkdownToHtml(md);
    expect(html).not.toContain("data-xml-block");
    expect(html).toContain("<code");
    expect(html).toContain("&lt;not-a-block&gt;");
  });

  it("preserves inline XML tags in paragraphs", () => {
    const md = "this has <custom-tag/> inline\n";
    const html = parseMarkdownToHtml(md);
    expect(html).toContain("<custom-tag/>");
    expect(html).not.toContain("data-xml-block");
  });

  it("treats entire block as XML when root is non-HTML even if children are HTML tag names", () => {
    const md = "<documents>\n<source>file.txt</source>\n</documents>\n";
    const html = parseMarkdownToHtml(md);
    expect(html).toContain('data-xml-block="true"');
    expect(html).toContain("&lt;source&gt;");
    expect(html).toContain("&lt;documents&gt;");
  });

  it("preserves raw content verbatim inside the XML block", () => {
    const raw = '<documents>\n<document index="1">\n<source>file.txt</source>\n</document>\n</documents>';
    const md = raw + "\n";
    const html = parseMarkdownToHtml(md);
    const match = html.match(/<code class="language-xml">([\s\S]*?)<\/code>/);
    expect(match).toBeTruthy();
    const decoded = match![1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
    expect(decoded).toBe(raw);
  });

  it("handles normal markdown alongside XML blocks", () => {
    const md = "# Title\n\n<instructions>\nDo this.\n</instructions>\n\nRegular **bold** text.\n";
    const html = parseMarkdownToHtml(md);
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain('data-xml-block="true"');
    expect(html).toContain("<strong>bold</strong>");
  });
});
