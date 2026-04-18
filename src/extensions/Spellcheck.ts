import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  isCorrect,
  autoCorrection,
  suggest,
} from "../services/spellcheck";

export interface MisspelledWord {
  word: string;
  from: number;
  to: number;
}

export interface SpellcheckPluginState {
  decorations: DecorationSet;
  misspelled: MisspelledWord[];
}

export const spellcheckPluginKey = new PluginKey<SpellcheckPluginState>(
  "spellcheck",
);

const WORD_RE = /[a-zA-Z\u00C0-\u024F']+/g;

function findWords(
  node: ProseMirrorNode,
  offset: number,
): { word: string; from: number; to: number }[] {
  const text = node.textContent;
  const results: { word: string; from: number; to: number }[] = [];
  let match;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.replace(/^'+|'+$/g, "");
    if (!trimmed) continue;
    const start = match.index + raw.indexOf(trimmed);
    results.push({
      word: trimmed,
      from: offset + start,
      to: offset + start + trimmed.length,
    });
  }
  return results;
}

function scanDocument(doc: ProseMirrorNode): SpellcheckPluginState {
  const misspelled: MisspelledWord[] = [];
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") return false;
    if (!node.isText || !node.text) return;

    const marks = node.marks || [];
    if (marks.some((m) => m.type.name === "code" || m.type.name === "link")) {
      return;
    }

    const words = findWords(node, pos);
    for (const { word, from, to } of words) {
      if (!isCorrect(word)) {
        misspelled.push({ word, from, to });
        decorations.push(
          Decoration.inline(from, to, {
            class: "spellcheck-error",
            nodeName: "span",
          }),
        );
      }
    }
  });

  return {
    decorations: DecorationSet.create(doc, decorations),
    misspelled,
  };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Trigger an immediate full rescan of the document. */
export function triggerRescan(view: EditorView): void {
  const result = scanDocument(view.state.doc);
  view.dispatch(view.state.tr.setMeta(spellcheckPluginKey, result));
}

export const Spellcheck = Extension.create({
  name: "spellcheck",

  addProseMirrorPlugins() {
    const plugin = new Plugin<SpellcheckPluginState>({
      key: spellcheckPluginKey,

      state: {
        init(_, { doc }) {
          return scanDocument(doc);
        },

        apply(tr, oldState) {
          // If this transaction carries a full rescan, use it directly
          const meta = tr.getMeta(spellcheckPluginKey) as
            | SpellcheckPluginState
            | undefined;
          if (meta) return meta;

          // If doc didn't change, keep existing state
          if (!tr.docChanged) return oldState;

          // Map existing decorations through the changes for visual continuity
          // (a full rescan follows via the debounced view update)
          return {
            decorations: oldState.decorations.map(tr.mapping, tr.doc),
            misspelled: oldState.misspelled
              .map((m) => {
                const from = tr.mapping.map(m.from, 1);
                const to = tr.mapping.map(m.to, -1);
                if (from >= to) return null;
                return { word: m.word, from, to };
              })
              .filter((m): m is MisspelledWord => m !== null),
          };
        },
      },

      props: {
        decorations(state) {
          return spellcheckPluginKey.getState(state)?.decorations;
        },

        handleDOMEvents: {
          contextmenu(view: EditorView, event: MouseEvent) {
            const pos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            if (!pos) return false;

            const pluginState = spellcheckPluginKey.getState(view.state);
            if (!pluginState) return false;

            const hit = pluginState.misspelled.find(
              (m) => pos.pos >= m.from && pos.pos <= m.to,
            );
            if (!hit) return false;

            window.dispatchEvent(
              new CustomEvent("spellcheck-context", {
                detail: {
                  word: hit.word,
                  from: hit.from,
                  to: hit.to,
                  suggestions: suggest(hit.word, 5),
                  x: event.clientX,
                  y: event.clientY,
                },
              }),
            );
            event.preventDefault();
            return true;
          },
        },
      },

      view() {
        return {
          update(view: EditorView, prevState) {
            if (view.state.doc.eq(prevState.doc)) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              const result = scanDocument(view.state.doc);
              view.dispatch(
                view.state.tr.setMeta(spellcheckPluginKey, result),
              );
            }, 400);
          },
        };
      },

      appendTransaction(transactions, _oldState, newState) {
        // Auto-correct: detect word boundary typed after a misspelled word
        const lastTr = transactions[transactions.length - 1];
        if (!lastTr || !lastTr.docChanged || lastTr.steps.length !== 1) {
          return null;
        }

        // Skip if this transaction was a spellcheck rescan
        if (lastTr.getMeta(spellcheckPluginKey)) return null;

        const stepJson = lastTr.steps[0].toJSON();
        if (stepJson.stepType !== "replace" || !stepJson.slice?.content) {
          return null;
        }

        const content = stepJson.slice.content;
        if (
          content.length !== 1 ||
          content[0].type !== "text" ||
          !content[0].text ||
          content[0].text.length !== 1
        ) {
          return null;
        }

        const typed: string = content[0].text;
        // Only trigger on word boundaries (space, punctuation, etc.)
        if (/[a-zA-Z\u00C0-\u024F']/.test(typed)) return null;

        const insertPos: number = stepJson.from;
        const doc = newState.doc;
        const $pos = doc.resolve(insertPos);
        const textBefore = $pos.parent.textBetween(
          0,
          $pos.parentOffset,
          undefined,
          "\ufffc",
        );

        const wordMatch = textBefore.match(/([a-zA-Z\u00C0-\u024F']+)$/);
        if (!wordMatch) return null;

        const rawWord = wordMatch[1];
        const word = rawWord.replace(/^'+|'+$/g, "");
        if (!word || word.length < 3) return null;

        // Skip if inside code or link marks
        const marks = $pos.marks();
        if (marks.some((m) => m.type.name === "code" || m.type.name === "link")) {
          return null;
        }

        const correction = autoCorrection(word);
        if (!correction) return null;

        const wordFrom = $pos.start() + $pos.parentOffset - rawWord.length;
        const wordTo = $pos.start() + $pos.parentOffset;
        return newState.tr.replaceWith(
          wordFrom,
          wordTo,
          newState.schema.text(correction),
        );
      },
    });

    return [plugin];
  },
});
