declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    spell(word: string): { correct: boolean };
    add(word: string): this;
    remove(word: string): this;
    wordCharacters(): string | undefined;
    dictionary(dic: string | Uint8Array): this;
    personal(dic: string): this;
  }

  interface NSpellConstructor {
    (aff: string | Uint8Array, dic: string | Uint8Array): NSpell;
    new (aff: string | Uint8Array, dic: string | Uint8Array): NSpell;
  }

  const nspell: NSpellConstructor;
  export = nspell;
}

declare module "*.aff?raw" {
  const content: string;
  export default content;
}

declare module "*.dic?raw" {
  const content: string;
  export default content;
}
