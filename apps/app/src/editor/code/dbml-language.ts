/**
 * DBML syntax highlighting for the code panel (046 research R10): a small Monarch tokenizer of
 * our own, so no dependency is added. Token classes reuse the ones `monaco-theme.ts` colours:
 * `keyword` (block words), `type` (settings in `[…]`), `string`, `comment`, `number`.
 */
import type { languages as Languages } from 'monaco-editor/editor/editor.api';

export const DBML_LANGUAGE_ID = 'dbml';

/** Block words, matched at a word boundary and only where a block can start. */
export const DBML_BLOCK_WORDS = [
  'Table',
  'TableGroup',
  'Ref',
  'Enum',
  'Project',
  'Note',
  'indexes',
  'checks',
  'records',
] as const;

/** Words inside `[…]`: the settings DBML knows. */
export const DBML_SETTING_WORDS = [
  'pk',
  'primary',
  'key',
  'null',
  'not',
  'unique',
  'increment',
  'default',
  'note',
  'ref',
  'name',
  'type',
  'headercolor',
  'color',
  'delete',
  'update',
  'cascade',
  'restrict',
  'set',
  'no',
  'action',
] as const;

export const dbmlLanguage: Languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.dbml',
  blockWords: [...DBML_BLOCK_WORDS],
  settingWords: [...DBML_SETTING_WORDS],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/'''/, 'string', '@tripleString'],
      [/'/, 'string', '@singleString'],
      [/"/, 'string', '@doubleString'],
      [/`[^`]*`/, 'string'],
      [/\[/, 'delimiter.bracket', '@settings'],
      [/\d+(\.\d+)?/, 'number'],
      [/[A-Za-z_][\w$]*/, { cases: { '@blockWords': 'keyword', '@default': 'identifier' } }],
      [/[{}()]/, 'delimiter.bracket'],
      [/[:,.<>-]+/, 'delimiter'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
    tripleString: [
      [/[^']+/, 'string'],
      [/'''/, 'string', '@pop'],
      [/'/, 'string'],
    ],
    singleString: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
    doubleString: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
    settings: [
      [/\]/, 'delimiter.bracket', '@pop'],
      [/'''/, 'string', '@tripleString'],
      [/'/, 'string', '@singleString'],
      [/"/, 'string', '@doubleString'],
      [/`[^`]*`/, 'string'],
      [/\d+(\.\d+)?/, 'number'],
      [/[A-Za-z_][\w$]*/, { cases: { '@settingWords': 'type', '@default': 'identifier' } }],
      [/[:,.<>-]+/, 'delimiter'],
    ],
  },
};

/** Registers the language once; safe to call again. */
export function registerDbml(api: {
  languages: Pick<typeof Languages, 'register' | 'setMonarchTokensProvider' | 'getLanguages'>;
}): void {
  if (api.languages.getLanguages().some((l) => l.id === DBML_LANGUAGE_ID)) return;
  api.languages.register({ id: DBML_LANGUAGE_ID, extensions: ['.dbml'], aliases: ['DBML'] });
  api.languages.setMonarchTokensProvider(DBML_LANGUAGE_ID, dbmlLanguage);
}
