/**
 * Design tokens for the landing page visuals, as CSS custom properties from `@sododeck/ui`
 * (`tokens.css`). Inline styles reference these, never raw colours, so light and dark follow the
 * `.dark` class on <html>.
 */
export const C = {
  surface: 'var(--sd-surface)',
  surface2: 'var(--sd-surface-2)',
  surface3: 'var(--sd-surface-3)',
  canvas: 'var(--sd-canvas)',
  dot: 'var(--sd-dot)',
  hairline: 'var(--sd-hairline)',
  border: 'var(--sd-border)',
  borderStrong: 'var(--sd-border-strong)',
  edge: 'var(--sd-deck-edge)',
  ink: 'var(--sd-ink)',
  inkSecondary: 'var(--sd-text-secondary)',
  muted: 'var(--sd-muted)',
  primary: 'var(--sd-primary)',
  primarySoft: 'var(--sd-primary-soft)',
  primaryInk: 'var(--sd-primary-ink)',
  onPrimary: 'var(--sd-on-primary)',
  clay: 'var(--sd-clay-ink)',
  claySoft: 'var(--sd-clay-soft)',
  amberSoft: 'var(--sd-amber-soft)',
  amberInk: 'var(--sd-amber-ink)',
  inverse: 'var(--sd-inverse)',
  onInverse: 'var(--sd-on-inverse)',
  shadow: 'var(--sd-shadow)',
  code: 'var(--sd-code)',
  textSelection: 'var(--sd-deck-text-selection)',
} as const;

export const FONT_SANS = 'var(--font-sans)';
export const FONT_MONO = 'var(--font-mono)';

/** The 13 named card colours (020, 029). */
export type Hue =
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'slate';

export const HUES: readonly Hue[] = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'slate',
];

export type HuePart = 'fill' | 'stroke' | 'chip' | 'ink' | 'dot';

/** One part of a named card colour, e.g. `pal('blue', 'fill')`. */
export const pal = (hue: Hue, part: HuePart): string => `var(--sd-card-${hue}-${part})`;

/** The floating panel shadow of the Deck look: the 3px lip plus a soft drop. */
export const PANEL_SHADOW = `0 3px 0 0 ${C.borderStrong}, 0 10px 28px ${C.shadow}`;
/** The code panel shadow (canvas-first panels). */
export const FLOAT_SHADOW = `0 8px 28px ${C.shadow}, 0 1px 2px ${C.shadow}`;
