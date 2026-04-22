import nspell from "nspell";
import affData from "../../node_modules/dictionary-en/index.aff?raw";
import dicData from "../../node_modules/dictionary-en/index.dic?raw";

type NSpellInstance = ReturnType<typeof nspell>;

let spellInstance: NSpellInstance | null = null;
const ignoreSet = new Set<string>();

function getSpeller(): NSpellInstance {
  if (!spellInstance) {
    spellInstance = nspell(affData as string, dicData as string);
  }
  return spellInstance;
}

/** Check if a word is spelled correctly (or ignored). */
export function isCorrect(word: string): boolean {
  if (ignoreSet.has(word.toLowerCase())) return true;
  if (shouldSkip(word)) return true;
  return getSpeller().correct(word);
}

/** Get up to `max` spelling suggestions, ranked best-first. */
export function suggest(word: string, max = 5): string[] {
  const raw = getSpeller().suggest(word);
  // Re-rank by edit distance, then alphabetically for ties
  return raw
    .map((s) => ({ word: s, dist: editDistance(word.toLowerCase(), s.toLowerCase()) }))
    .sort((a, b) => a.dist - b.dist || a.word.localeCompare(b.word))
    .slice(0, max)
    .map((s) => s.word);
}

/**
 * If there's a high-confidence correction, return it. Otherwise null.
 * High confidence = single-character edit distance AND the top suggestion
 * is clearly best (distance 1 while others are >= 2).
 */
export function autoCorrection(word: string): string | null {
  if (word.length < 3) return null;
  if (shouldSkip(word)) return null;
  if (ignoreSet.has(word.toLowerCase())) return null;
  if (getSpeller().correct(word)) return null;

  const suggestions = getSpeller().suggest(word);
  if (suggestions.length === 0) return null;

  const top = suggestions[0];
  const dist = editDistance(word.toLowerCase(), top.toLowerCase());

  // Only auto-correct for edit distance 1 (single typo)
  if (dist !== 1) return null;

  // If there's a second suggestion also at distance 1, it's ambiguous
  if (suggestions.length > 1) {
    const dist2 = editDistance(word.toLowerCase(), suggestions[1].toLowerCase());
    if (dist2 === 1) return null;
  }

  // Preserve the original casing pattern
  return matchCase(word, top);
}

/** Add a word to the per-session ignore list. */
export function ignoreWord(word: string): void {
  ignoreSet.add(word.toLowerCase());
}

/** Words we should never spellcheck. */
function shouldSkip(word: string): boolean {
  // All uppercase (acronyms)
  if (word === word.toUpperCase() && word.length > 1) return true;
  // Contains digits
  if (/\d/.test(word)) return true;
  // Very short
  if (word.length <= 1) return true;
  // Looks like a path or URL fragment
  if (word.includes("/") || word.includes("\\")) return true;
  return false;
}

/** Levenshtein edit distance. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Match the casing pattern of `original` onto `replacement`. */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement.toLowerCase();
}
