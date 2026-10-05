/**
 * Where tables land when they change level (049, research R2): moved into another database card,
 * or left unowned on the level above when removed from a card or when their card is deleted. A
 * position is read at its own drill level, so a table keeps its spot when that spot is free there
 * and otherwise takes the first free cell of a grid from `anchor`. Pure.
 */
import { baseViewId, resolveViews, type DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { cardBox, type Point, type Rect } from './canvas-geometry';

/** Space kept around a placed table. */
const GAP = 24;
/** Grid cells tried before giving up and stacking at the anchor. */
const MAX_CELLS = 400;
const COLUMNS = 20;

const hits = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + GAP &&
  b.x < a.x + a.width + GAP &&
  a.y < b.y + b.height + GAP &&
  b.y < a.y + a.height + GAP;

/**
 * Positions for `tableIds` at the level of `parent` (a card id, or `undefined` for the top level),
 * so that none overlaps a node already there or another placed table. Tables whose current spot
 * is free keep it. Returns only the tables that move.
 */
export function placeTables(
  deck: SododeckFile,
  tableIds: readonly Id[],
  parent: Id | undefined,
  anchor: Point,
): Map<Id, Point> {
  const moving = new Set(tableIds);
  const occupied: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    if (!moving.has(node.id) && node.parent === parent) {
      occupied.push(cardBox(node, index, 'system'));
    }
  });
  const out = new Map<Id, Point>();
  deck.nodes.forEach((node, index) => {
    if (!moving.has(node.id)) return;
    const box = cardBox(node, index, 'system');
    const free = (at: Point) => !occupied.some((other) => hits({ ...box, ...at }, other));
    let spot: Point | undefined = free(box) ? { x: box.x, y: box.y } : undefined;
    for (let cell = 0; spot === undefined && cell < MAX_CELLS; cell++) {
      const at = {
        x: Math.round(anchor.x + (cell % COLUMNS) * (box.width + GAP)),
        y: Math.round(anchor.y + Math.floor(cell / COLUMNS) * (box.height + GAP)),
      };
      if (free(at)) spot = at;
    }
    spot ??= { x: Math.round(anchor.x), y: Math.round(anchor.y) };
    occupied.push({ ...box, ...spot });
    if (spot.x !== box.x || spot.y !== box.y) out.set(node.id, spot);
  });
  return out;
}

/** Where tables a card lets go of start looking for room: just below the card. */
export function belowCard(deck: SododeckFile, cardId: Id): Point {
  const index = deck.nodes.findIndex((node) => node.id === cardId);
  const card = deck.nodes[index];
  if (card === undefined) return { x: 0, y: 0 };
  const box = cardBox(card, index, 'system');
  return { x: box.x, y: box.y + box.height + 2 * GAP };
}

/** Writes `positions` as base positions (call inside the caller's batch: one undo step). */
export function writeBasePositions(
  editor: DeckEditor,
  deck: SododeckFile,
  positions: ReadonlyMap<Id, Point>,
): void {
  if (positions.size === 0) return;
  editor.moveInView(baseViewId(resolveViews(deck)), Object.fromEntries(positions));
}
