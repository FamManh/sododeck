/**
 * Shared keyboard focus indicator for every interactive building block.
 *
 * A 2px Deck Orange outline with a 2px gap: the gap sits on the surrounding surface, so the
 * outline measures 3.14:1 (light) / 6.44:1 (dark) against it, which meets WCAG 3:1. The design's
 * soft orange halo (`shadow-selection`) is only ~1.1:1, so it is kept for selection, not focus.
 * See specs/000-design-foundation/research.md R5.
 */
export const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
