/**
 * The four ways a `.sododeck.md` note can fail to yield a deck block (070, contract
 * `specs/070-obsidian-plugin/contracts/markdown-form.md`). Kept apart from `problem-codes.ts` so
 * `markdown-form.ts` can build its entries without loading the model's Yjs-bound modules; the
 * catalogue imports this table, so the codes are documented like every other code.
 */
export const MD_PROBLEM_CODES = [
  'md-no-marker',
  'md-no-deck-block',
  'md-deck-block-not-json',
  'md-two-deck-blocks',
] as const;

export type MdProblemCode = (typeof MD_PROBLEM_CODES)[number];

export interface MdProblem {
  title: string;
  message: string;
  fix: string;
}

export const MD_PROBLEMS: Readonly<Record<MdProblemCode, MdProblem>> = {
  'md-no-marker': {
    title: 'Not a Sododeck note',
    message:
      'This note has no "sododeck-plugin: parsed" line in its front matter, so it is not a deck.',
    fix: 'Add "sododeck-plugin: parsed" to the front matter, or export the deck again as .sododeck.md.',
  },
  'md-no-deck-block': {
    title: 'Deck data missing',
    message:
      'This note has no deck data block (the "%% sododeck:data" part), so there is no deck to show.',
    fix: 'Restore the deck data block from your sync history or backup, or export the deck again.',
  },
  'md-deck-block-not-json': {
    title: 'Deck data is not JSON',
    message: 'The deck data block in this note is not valid JSON.',
    fix: 'Fix the JSON syntax inside the "sododeck:data" block, or restore it from your sync history.',
  },
  'md-two-deck-blocks': {
    title: 'Two deck data blocks',
    message:
      'This note has more than one deck data block, so it is not clear which one is the deck.',
    fix: 'Delete the extra "sododeck:data" block so exactly one remains.',
  },
};
