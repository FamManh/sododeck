import type { FocusSet } from '../focus-set';

/** One quoted attribute selector per id; `CSS.escape` keeps `:`, `|` and quotes inert. */
const byAttribute = (name: string, id: string) => `[${name}="${CSS.escape(id)}"]`;

/** `:not(:is(…))` over the given ids, or no condition when there are none. */
function except(name: string, ids: Iterable<string>): string {
  const list = [...ids].map((id) => byAttribute(name, id));
  return list.length === 0 ? '' : `:not(:is(${list.join(', ')}))`;
}

function only(name: string, ids: Iterable<string>): string | null {
  const list = [...ids].map((id) => byAttribute(name, id));
  return list.length === 0 ? null : `:is(${list.join(', ')})`;
}

/**
 * The stylesheet for one hover focus (034 R1). Only non-members get an opacity, so a member that
 * a saved view dims keeps the view's opacity (FR-004). No `inert` and no `aria-hidden`: the
 * pointer must reach the next card, and assistive tech keeps every card. There is no fade: a
 * transition would start one per card and connector in the first frame (~40 ms at 500 / 1,000,
 * measured), against SC-001's 16 ms; the fade belongs to pinned focus, which rebuilds anyway.
 */
export function hoverFocusCss(set: FocusSet): string {
  const scope = '[data-hover-focus]';
  const neighbours = [...set.members].filter((id) => id !== set.focusId);
  const lines = [
    `${scope} .react-flow__node:not(.react-flow__node-group-boundary)${except('data-id', set.members)} { opacity: var(--sd-deck-dim); }`,
    `${scope} .react-flow__edge${except('data-id', set.edges)} { opacity: var(--color-deck-dim-edge); }`,
    `${scope} [data-edge-label-for]${except('data-edge-label-for', set.edges)} { opacity: var(--color-deck-dim-edge); }`,
  ];
  const lit = only('data-id', set.edges);
  if (lit !== null) {
    // Colour and weight are two rules on purpose, so a styled connector (022) can drop one.
    lines.push(
      `${scope} .react-flow__edge${lit} { --sd-edge-hl-stroke: var(--color-ink); }`,
      `${scope} .react-flow__edge${lit} { --sd-edge-hl-width: 2.75px; }`,
    );
  }
  lines.push(...relationshipRowsCss(set.rows ?? new Set(), set.edges, scope));
  const near = only('data-id', neighbours);
  if (near !== null) {
    lines.push(
      `${scope} .react-flow__node${near} .sd-card { border-color: var(--color-ink-secondary); --card-lip: var(--color-ink-secondary); --tw-shadow: 0 var(--sd-deck-lip) 0 0 var(--card-lip); }`,
    );
  }
  return lines.join('\n');
}

/**
 * Lit column rows and revealed hover-only labels (042 R14): the rows take Orange Soft and a
 * heavier name, so they read without colour too; a lit relationship's hover-only label shows.
 * Used inside a hover focus, and alone for a hovered or selected relationship (no dimming).
 */
export function relationshipRowsCss(
  rows: ReadonlySet<string>,
  edges: Iterable<string>,
  scope = '[data-canvas]',
): string[] {
  const lines: string[] = [];
  const lit = only('data-row', rows);
  if (lit !== null) {
    lines.push(
      `${scope} ${lit} { background: var(--color-deck-orange-soft); }`,
      `${scope} ${lit} > span { font-weight: 600; }`,
    );
  }
  const labels = only('data-edge-label-for', edges);
  if (labels !== null) lines.push(`${scope} ${labels}.sd-rel-hover-label { visibility: visible; }`);
  return lines;
}
