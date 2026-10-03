/**
 * Canvas edits shared by the palette, drag-and-drop, `onConnect` and keyboard connect. Each one
 * writes through the editor (one undo step) and then updates UI-only state.
 */
import type { DeckEditor } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { cardSize, freeSpot, NODE_SIZE, type Point } from './canvas-geometry';
import { connectionCheck, REFUSAL_TEXT } from './connection-rules';
import { typeName } from './type-label';
import { readViewState } from './views/use-current-view';

/** Marks the canvas wrapper, so focus helpers and the palette can find it. */
export const CANVAS_ATTR = 'data-canvas';

/** Whole pixels (positions are integers); a non-finite coordinate (no layout yet) becomes 0. */
const round = ({ x, y }: Point): Point => ({
  x: Number.isFinite(x) ? Math.round(x) : 0,
  y: Number.isFinite(y) ? Math.round(y) : 0,
});

/** Top-left position for a node centred on a flow point. */
export function centredOn(point: Point, type?: string): Point {
  // A shape type is centred by its own default size (031); a card by the default card.
  const size = type === undefined ? NODE_SIZE : cardSize({ type });
  return round({ x: point.x - size.width / 2, y: point.y - size.height / 2 });
}

/**
 * Adds "Untitled <type>" at `position` (moved to a free spot), selects it and announces it. With
 * `edit`, the new card starts in title edit with an empty field (019 FR-011); the stored title is
 * the fallback kept when the user leaves it empty (FR-014, ADR 0015: a title is never empty).
 */
export function addComponent(
  editor: DeckEditor,
  type: string,
  position: Point,
  { edit = false }: { edit?: boolean } = {},
): string {
  const title = `Untitled ${typeName(type).toLowerCase()}`;
  const id = editor.add('nodes', {
    type,
    title,
    position: freeSpot(readViewState(editor.doc).deck, round(position)),
  });
  const ui = useUiStore.getState();
  // A new component the current view hides stays visible here until the view is left (011).
  if (readViewState(editor.doc).hidden.has(id)) ui.reveal(id);
  ui.select({ nodes: [id] });
  ui.focus(id);
  ui.announce(`Added ${title}`);
  if (edit) ui.startTitleEdit({ target: 'node', id, isNew: true, kind: type });
  return id;
}

/** Selects every component the current view shows (⌘A and the canvas menu's Select all). */
export function selectAllComponents(editor: DeckEditor): void {
  const deck = readViewState(editor.doc).deck;
  const ui = useUiStore.getState();
  ui.select({ nodes: deck.nodes.map((n) => n.id) });
  ui.announce(`${String(deck.nodes.length)} selected`);
}

function titleOf(deck: SododeckFile, id: string): string {
  return deck.nodes.find((n) => n.id === id)?.title ?? id;
}

/**
 * Draws a connection if the canvas rules allow it, then selects it and opens its popover.
 * Returns the new edge id, or null (and announces why) when refused.
 */
export function connectComponents(editor: DeckEditor, from: string, to: string): string | null {
  const deck = readDeck(editor.doc);
  const ui = useUiStore.getState();
  const check = connectionCheck(deck, from, to);
  if (check !== 'ok') {
    ui.announce(REFUSAL_TEXT[check]);
    return null;
  }
  // Curved is the default look, so it is never stored (029 R7).
  const { lastLineShape } = ui;
  const id = editor.add(
    'edges',
    lastLineShape === 'curved' ? { from, to } : { from, to, style: { shape: lastLineShape } },
  );
  ui.select({ edges: [id] });
  ui.openEdgePopover(id);
  ui.announce(`Connected ${titleOf(deck, from)} to ${titleOf(deck, to)}`);
  return id;
}

/** The canvas wrapper element, if the canvas is mounted. */
export function canvasElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${CANVAS_ATTR}]`);
}

/** Measures the edge's label point (deck-edge.tsx), else the canvas centre. */
export function anchorRect(edgeId: string): DOMRect {
  const anchor = document.querySelector(`[data-edge-anchor="${CSS.escape(edgeId)}"]`);
  if (anchor) return anchor.getBoundingClientRect();
  const canvas = canvasElement()?.getBoundingClientRect();
  return new DOMRect(
    (canvas?.left ?? 0) + (canvas?.width ?? 0) / 2,
    (canvas?.top ?? 0) + (canvas?.height ?? 0) / 2,
    0,
    0,
  );
}

/** The focusable element of a component on the canvas, if it is rendered. */
export function nodeElement(id: string): HTMLElement | null {
  return canvasElement()?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) ?? null;
}

/** Puts keyboard focus back on the canvas: the focused component, else the canvas itself. */
export function focusCanvas(): void {
  const { focusedId } = useUiStore.getState();
  const target = (focusedId === null ? null : nodeElement(focusedId)) ?? canvasElement();
  target?.focus({ preventScroll: true });
}

export const PALETTE_ID = 'palette-panel';

/** Focuses the Add flyout's search field once the flyout is shown. */
export function focusPalette(): void {
  setTimeout(() => {
    document.querySelector<HTMLElement>(`#${PALETTE_ID} input`)?.focus();
  }, 0);
}
