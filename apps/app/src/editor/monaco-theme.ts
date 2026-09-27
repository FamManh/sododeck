/**
 * Monaco themes built from the design tokens (004 research R6). Monaco needs literal hex colors,
 * so the values are read from the CSS variables at runtime; no color is hard-coded here.
 */
import type { editor } from 'monaco-editor/editor/editor.api';

export const THEME_TOKENS = [
  '--sd-code',
  '--sd-ink',
  '--sd-blue-ink',
  '--sd-primary-ink',
  '--sd-amber-ink',
  '--sd-muted',
  '--sd-primary-soft',
  '--sd-surface-2',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];
export type ThemeTokens = Record<ThemeToken, string>;

/** Current token values (the `.dark` class on the root switches them). */
export function readThemeTokens(el: Element = document.documentElement): ThemeTokens {
  const style = getComputedStyle(el);
  return Object.fromEntries(
    THEME_TOKENS.map((name) => [name, style.getPropertyValue(name).trim()]),
  ) as ThemeTokens;
}

/** Token rules take colors without the leading `#`. */
const bare = (hex: string) => hex.replace(/^#/, '');

export function buildMonacoTheme(
  tokens: ThemeTokens,
  base: 'vs' | 'vs-dark',
): editor.IStandaloneThemeData {
  return {
    base,
    inherit: true,
    rules: [
      { token: '', foreground: bare(tokens['--sd-ink']) },
      { token: 'string.key.json', foreground: bare(tokens['--sd-ink']) },
      { token: 'string.value.json', foreground: bare(tokens['--sd-blue-ink']) },
      { token: 'number', foreground: bare(tokens['--sd-primary-ink']) },
      { token: 'keyword', foreground: bare(tokens['--sd-amber-ink']) },
      { token: 'delimiter', foreground: bare(tokens['--sd-muted']) },
    ],
    colors: {
      'editor.background': tokens['--sd-code'],
      'editor.foreground': tokens['--sd-ink'],
      'editorGutter.background': tokens['--sd-code'],
      'editorLineNumber.foreground': tokens['--sd-muted'],
      'editorLineNumber.activeForeground': tokens['--sd-ink'],
      'editor.selectionBackground': tokens['--sd-primary-soft'],
      'editor.inactiveSelectionBackground': tokens['--sd-primary-soft'],
      'editor.lineHighlightBackground': tokens['--sd-surface-2'],
      'editor.lineHighlightBorder': tokens['--sd-surface-2'],
    },
  };
}
