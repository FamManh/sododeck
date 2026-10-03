import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../src/lib/contrast';

describe('contrastRatio', () => {
  it('is 21 for white on black', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('matches the DESIGN.md figure for Deck Orange on white', () => {
    expect(contrastRatio('#f2661c', '#ffffff')).toBeCloseTo(3.14, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1c1c1a', '#f4f4f1')).toBe(contrastRatio('#f4f4f1', '#1c1c1a'));
  });

  it('accepts 3-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('throws on invalid input', () => {
    expect(() => contrastRatio('orange', '#fff')).toThrow();
    expect(() => contrastRatio('#12345', '#fff')).toThrow();
  });
});

// ── Token pairs used by the building blocks (FR-023, SC-004) ──

const tokensCss = readFileSync(resolve(import.meta.dirname, '../src/styles/tokens.css'), 'utf8');

/** `--sd-name: #hex;` pairs from one CSS block (rgba values such as scrim/shadow are skipped). */
function hexTokens(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--sd-([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map(
      (match) => [match[1] ?? '', match[2] ?? ''] as const,
    ),
  );
}

const light = hexTokens(/:root\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '');
const dark = new Map([...light, ...hexTokens(/\.dark\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '')]);

type Pair = [foreground: string, background: string];

/** The 13 card colour names (020, DESIGN.md order). */
const CARD_COLOR_NAMES = [
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
] as const;

/** Text and meaningful icons: WCAG 2.1 AA 4.5:1. */
const TEXT_PAIRS: Pair[] = [
  ['ink', 'surface'],
  ['ink', 'surface-2'],
  ['text-secondary', 'surface'],
  ['text-secondary', 'surface-2'],
  ['muted', 'surface'],
  ['on-primary', 'primary'],
  ['on-inverse', 'inverse'],
  ['primary-ink', 'primary-soft'],
  ['amber-ink', 'amber-soft'],
  ['blue-ink', 'blue-soft'],
  ['clay-ink', 'clay-soft'],
  ['success-ink', 'success-soft'],
  // Card fills (020): ink and text-secondary stay readable on every named card fill.
  ...CARD_COLOR_NAMES.flatMap((name): Pair[] => [
    ['ink', `card-${name}-fill`],
    ['text-secondary', `card-${name}-fill`],
  ]),
  // Deck chips (029): tag and field chip text on its tint.
  ...CARD_COLOR_NAMES.map((name): Pair => [`card-${name}-ink`, `card-${name}-chip`]),
];

/** Sticky-note tints (009): each note body and its icon/label text stay AA in both themes. */
const STICKY_TINT_TEXT_PAIRS: Pair[] = [
  ['amber-ink', 'amber-soft'],
  ['blue-ink', 'blue-soft'],
  ['clay-ink', 'clay-soft'],
  ['success-ink', 'success-soft'],
  ['text-secondary', 'surface-2'],
];

/** Focus indicator and other non-text cues: WCAG 1.4.11 3:1. */
const NON_TEXT_PAIRS: Pair[] = [
  ['primary', 'surface'], // focus outline (2px gap sits on surface)
  ['on-inverse', 'inverse'], // focus outline on the coach mark
  ['clay-ink', 'surface'], // invalid input border + icon
  ['muted', 'surface'], // dashed border of a partial tag chip (008 bulk edit)
  ['success-ink', 'surface'], // matched-row check icon (008 decision tables)
  ['primary', 'canvas'], // snap guides, drop-target and landing-slot dashes, resize handles (016)
  // Card strokes (020): every named card stroke stays visible against the card surface.
  ...CARD_COLOR_NAMES.map((name): Pair => [`card-${name}-stroke`, 'surface']),
  // Deck dots (029): the 6px dot and status icon on the card fill.
  ...CARD_COLOR_NAMES.map((name): Pair => [`card-${name}-dot`, `card-${name}-fill`]),
];
// Not asserted: primary fill vs inverse (coach-mark Next button) is 2.38:1 in dark. WCAG 1.4.11
// does not require a text button's fill to contrast with its background; the label identifies
// it and on-primary/primary is asserted above.

/**
 * Founder-approved exceptions (2026-09-27, plan.md Complexity Tracking, research.md R5):
 * kept as designed, mitigated by visible labels, the focus outline and the switch thumb position.
 * Adding a pair here needs founder approval.
 */
const APPROVED_EXCEPTIONS: Pair[] = [
  ['border', 'surface'], // input border
  ['surface-3', 'surface'], // switch off track
];

function ratio(theme: Map<string, string>, [fg, bg]: Pair): number {
  const a = theme.get(fg);
  const b = theme.get(bg);
  if (a === undefined || b === undefined) throw new Error(`Missing token: ${fg} or ${bg}`);
  return contrastRatio(a, b);
}

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('token contrast (%s)', (_name, theme) => {
  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(ratio(theme, [fg, bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STICKY_TINT_TEXT_PAIRS)('sticky tint %s on %s is at least 4.5:1', (fg, bg) => {
    expect(ratio(theme, [fg, bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s on %s is at least 3:1', (fg, bg) => {
    expect(ratio(theme, [fg, bg])).toBeGreaterThanOrEqual(3);
  });

  it.each(APPROVED_EXCEPTIONS)('%s on %s is a known, approved exception (< 3:1)', (fg, bg) => {
    // If a token change fixes one of these, remove it from the list.
    expect(ratio(theme, [fg, bg])).toBeLessThan(3);
  });
});

describe('muted text on surface-2', () => {
  it('fails AA in light, which is why components use ink-secondary there', () => {
    expect(ratio(light, ['muted', 'surface-2'])).toBeLessThan(4.5);
  });
});
