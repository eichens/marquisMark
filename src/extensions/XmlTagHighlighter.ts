import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const PLUGIN_KEY = new PluginKey("xmlTagHighlighter");
const TAG_REGEX = /<\/?[\w][\w:-]*\s*>/g;
const NUM_COLORS = 6;

interface TagMatch {
  from: number;
  to: number;
  name: string;
  isClosing: boolean;
  depth: number;
}

function findTags(doc: ProseMirrorNode): TagMatch[] {
  const tags: TagMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;

    TAG_REGEX.lastIndex = 0;
    let match;
    while ((match = TAG_REGEX.exec(text)) !== null) {
      const fullMatch = match[0];
      const isClosing = fullMatch.startsWith("</");
      const name = fullMatch.replace(/^<\/?/, "").replace(/\s*>$/, "");

      tags.push({
        from: pos + match.index,
        to: pos + match.index + fullMatch.length,
        name,
        isClosing,
        depth: 0,
      });
    }
  });

  return tags;
}

function assignDepths(tags: TagMatch[]): void {
  const stack: { name: string; depth: number }[] = [];

  for (const tag of tags) {
    if (!tag.isClosing) {
      // Opening tag: depth = current stack size, then push
      tag.depth = stack.length;
      stack.push({ name: tag.name, depth: tag.depth });
    } else {
      // Closing tag: find matching opening tag from top of stack
      let matched = false;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === tag.name) {
          tag.depth = stack[i].depth;
          stack.splice(i, 1);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Unmatched closing tag: use depth 0
        tag.depth = 0;
      }
    }
  }
  // Unmatched opening tags keep their assigned depth
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const tags = findTags(doc);
  assignDepths(tags);

  const decorations = tags.map((tag) =>
    Decoration.inline(tag.from, tag.to, {
      class: `xml-tag xml-tag-depth-${tag.depth % NUM_COLORS}`,
    })
  );

  return DecorationSet.create(doc, decorations);
}

export const XmlTagHighlighter = Extension.create({
  name: "xmlTagHighlighter",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: PLUGIN_KEY,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc);
          },
          apply(tr, oldDecorations) {
            if (!tr.docChanged) return oldDecorations;
            return buildDecorations(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
