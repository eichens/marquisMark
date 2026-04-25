import { Marked } from "marked";
import { HTML_TAGS } from "../lib/htmlTags";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getOpeningTagName(line: string): string | null {
  const trimmed = line.trimStart();
  if (trimmed[0] !== "<" || trimmed[1] === "/" || trimmed[1] === "!") return null;
  let i = 1;
  while (i < trimmed.length && /[\w:-]/.test(trimmed[i])) i++;
  if (i === 1) return null;
  return trimmed.slice(1, i).toLowerCase();
}

function isSelfClosing(line: string): boolean {
  return /\/\s*>\s*$/.test(line.trimEnd());
}

/**
 * Extract non-HTML XML-looking blocks (e.g. `<documents>…</documents>`) before
 * handing the source to `marked`. Without this pass, marked either strips the
 * tags or misinterprets the content between them. Each block is replaced with
 * a placeholder `<div>` that the parser will pass through untouched; the real
 * XML is re-substituted as a `<pre data-xml-block="true">` after parsing.
 *
 * Tag classification uses HTML_TAGS as the allow-list — anything not in the set
 * is treated as prompt-style XML.
 */
function extractXmlBlocks(markdown: string): { processed: string; blocks: Map<string, string> } {
  const lines = markdown.split("\n");
  const blocks = new Map<string, string>();
  const output: string[] = [];
  let blockLines: string[] = [];
  let blockTag: string | null = null;
  let depth = 0;
  let counter = 0;
  let inFencedCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^(`{3,}|~{3,})/.test(line.trimStart())) {
      if (!blockTag) {
        inFencedCode = !inFencedCode;
        output.push(line);
        continue;
      }
    }

    if (inFencedCode) {
      output.push(line);
      continue;
    }

    if (blockTag) {
      blockLines.push(line);
      const openTags = line.match(/<([\w][\w:-]*)/g) || [];
      const closeTags = line.match(/<\/([\w][\w:-]*)/g) || [];
      for (const tag of openTags) {
        const name = tag.slice(1).toLowerCase();
        if (!HTML_TAGS.has(name) && !isSelfClosing(line)) depth++;
      }
      for (const tag of closeTags) {
        const name = tag.slice(2).toLowerCase();
        if (!HTML_TAGS.has(name)) depth--;
      }
      if (depth <= 0) {
        const key = `XML_BLOCK_${counter++}`;
        const content = blockLines.join("\n").replace(/\n+$/, "");
        blocks.set(key, content);
        output.push(`<div data-xml-placeholder="${key}"></div>`);
        output.push("");
        blockLines = [];
        blockTag = null;
        depth = 0;
      }
      continue;
    }

    const tagName = getOpeningTagName(line);
    if (tagName && !HTML_TAGS.has(tagName)) {
      if (isSelfClosing(line)) {
        const key = `XML_BLOCK_${counter++}`;
        blocks.set(key, line);
        output.push(`<div data-xml-placeholder="${key}"></div>`);
        output.push("");
      } else {
        blockTag = tagName;
        blockLines = [line];
        depth = 1;
        const additionalOpens = (line.match(/<([\w][\w:-]*)/g) || []).slice(1);
        for (const tag of additionalOpens) {
          const name = tag.slice(1).toLowerCase();
          if (!HTML_TAGS.has(name) && !isSelfClosing(line)) depth++;
        }
        const closeTags = line.match(/<\/([\w][\w:-]*)/g) || [];
        for (const tag of closeTags) {
          const name = tag.slice(2).toLowerCase();
          if (!HTML_TAGS.has(name)) depth--;
        }
        if (depth <= 0) {
          const key = `XML_BLOCK_${counter++}`;
          blocks.set(key, line);
          output.push(`<div data-xml-placeholder="${key}"></div>`);
          output.push("");
          blockLines = [];
          blockTag = null;
          depth = 0;
        }
      }
    } else {
      output.push(line);
    }
  }

  if (blockTag && blockLines.length > 0) {
    const key = `XML_BLOCK_${counter++}`;
    const content = blockLines.join("\n").replace(/\n+$/, "");
    blocks.set(key, content);
    output.push(`<div data-xml-placeholder="${key}"></div>`);
    output.push("");
  }

  return { processed: output.join("\n"), blocks };
}

export function parseMarkdownToHtml(markdown: string): string {
  const { processed, blocks } = extractXmlBlocks(markdown);

  const m = new Marked();
  let html = m.parse(processed) as string;

  for (const [key, content] of blocks) {
    const placeholder = `<div data-xml-placeholder="${key}"></div>`;
    const xmlHtml = `<pre data-xml-block="true"><code class="language-xml">${escapeHtml(content)}</code></pre>`;
    html = html.replace(placeholder, xmlHtml);
  }

  return html;
}
