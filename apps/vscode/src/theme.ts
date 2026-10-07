import type { Scheme } from './ports';

/** `vscode.ColorThemeKind` values; numbers here so the logic never imports `vscode`. */
export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 } as const;

/** The editor's two schemes: both light kinds are light, both dark kinds are dark (FR-022). */
export function schemeOfKind(kind: number): Scheme {
  return kind === ColorThemeKind.Light || kind === ColorThemeKind.HighContrastLight
    ? 'light'
    : 'dark';
}
