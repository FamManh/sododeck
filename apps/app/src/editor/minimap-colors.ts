import type { CardLook } from './style/card-style';
import type { CanvasFlowNode } from './deck-to-flow';
import { stickySwatch } from './stickies/sticky-tint';

/** Cards and groups carry a `look`; notes carry a colour, so they keep their paper tone. */
function lookOf(node: CanvasFlowNode): CardLook | undefined {
  return node.data['look'] as CardLook | undefined;
}

function noteColour(node: CanvasFlowNode): Parameters<typeof stickySwatch>[0] {
  return node.data['color'] as Parameters<typeof stickySwatch>[0];
}

/**
 * The minimap's fill. Without this a note fell back to the neutral surface and read as an empty
 * card; its paper colour keeps notes apart from cards in the overview.
 */
export function minimapFill(node: CanvasFlowNode): string {
  if (node.type === 'sticky') return stickySwatch(noteColour(node)).swatch;
  return lookOf(node)?.fill ?? 'var(--color-surface-3)';
}

export function minimapStroke(node: CanvasFlowNode): string {
  if (node.type === 'sticky') return stickySwatch(noteColour(node)).ringSwatch;
  return lookOf(node)?.stroke ?? 'var(--color-border-strong)';
}
