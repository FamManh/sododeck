/**
 * "Spread ends evenly" (050 US7, research R10). Pure. For each selected card (or group) and each
 * of its sides, the connector ends drawn on that side are pinned at equal spacing,
 * `at = (i + 1) / (n + 1)`, which leaves a margin at both corners. Ends are ordered by where
 * their other end sits along the side's axis (x for top / bottom, y for left / right), so lines
 * cross as little as possible; ties go by edge id, so the result is stable. Automatic ends count
 * at the side they are drawn on, and both ends of a self-loop count. Sides with fewer than two
 * ends are left alone. The caller writes every patch in one `oneStep`.
 */
import type { EdgeRoutePatch } from '@sododeck/model';
import type { EdgeRoute, Id, Side } from '@sododeck/schema';

import { anchorPoint } from '../routing/connector-geometry';
import type { Box, Point } from '../routing/route-path';

/** One connector as the view draws it. `from` / `to` may name a card or a group. */
export interface SpreadEdge {
  id: Id;
  from: Id;
  to: Id;
  /** The sides each end is drawn on: pinned, or resolved for an automatic end. */
  fromSide: Side;
  toSide: Side;
  /** The stored route, for where each end sits along its side (0.5 when absent). */
  route?: Pick<EdgeRoute, 'fromAt' | 'toAt'> | undefined;
  /** Hidden in the current view (out of scope, filtered, inside a collapsed group…). */
  hidden?: boolean;
}

/** What `spreadEnds` reads: the drawn connectors and the box of every end, by deck id. */
export interface SpreadView {
  edges: readonly SpreadEdge[];
  /** Cards, collapsed-group cards and group frames as drawn; an end with no box is skipped. */
  boxes: ReadonlyMap<Id, Box>;
}

export interface SpreadPatch {
  edgeId: Id;
  patch: EdgeRoutePatch;
}

export interface SpreadPlan {
  /** One patch per changed connector, by edge id. */
  patches: SpreadPatch[];
  /** How many ends were placed, and on how many sides (for "Spread N ends on M sides"). */
  ends: number;
  sides: number;
}

interface End {
  edgeId: Id;
  end: 'from' | 'to';
  /** Position of the connector's other end along this side's axis. */
  key: number;
}

const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

function otherPoint(
  edge: SpreadEdge,
  end: 'from' | 'to',
  boxes: SpreadView['boxes'],
): Point | null {
  const otherId = end === 'from' ? edge.to : edge.from;
  const box = boxes.get(otherId);
  if (box === undefined) return null;
  return end === 'from'
    ? anchorPoint(box, edge.toSide, edge.route?.toAt ?? 0.5)
    : anchorPoint(box, edge.fromSide, edge.route?.fromAt ?? 0.5);
}

/** The plan: patches plus counts. Same input, same output. */
export function spreadEndsPlan(view: SpreadView, cardIds: readonly Id[]): SpreadPlan {
  const patches = new Map<Id, EdgeRoutePatch>();
  let ends = 0;
  let sides = 0;
  const cards = [...new Set(cardIds)].sort();
  for (const cardId of cards) {
    if (!view.boxes.has(cardId)) continue;
    const bySide = new Map<Side, End[]>();
    for (const edge of view.edges) {
      if (edge.hidden === true) continue;
      if (!view.boxes.has(edge.from) || !view.boxes.has(edge.to)) continue;
      for (const end of ['from', 'to'] as const) {
        if ((end === 'from' ? edge.from : edge.to) !== cardId) continue;
        const side = end === 'from' ? edge.fromSide : edge.toSide;
        const other = otherPoint(edge, end, view.boxes);
        if (other === null) continue;
        const key = side === 'top' || side === 'bottom' ? other.x : other.y;
        const list = bySide.get(side) ?? [];
        list.push({ edgeId: edge.id, end, key });
        bySide.set(side, list);
      }
    }
    for (const side of SIDES) {
      const list = bySide.get(side);
      if (list === undefined || list.length < 2) continue;
      list.sort(
        (a, b) =>
          a.key - b.key ||
          (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0) ||
          (a.end === b.end ? 0 : a.end === 'from' ? -1 : 1),
      );
      list.forEach((item, i) => {
        const at = r4((i + 1) / (list.length + 1));
        const patch = patches.get(item.edgeId) ?? {};
        if (item.end === 'from') {
          patch.fromSide = side;
          patch.fromAt = at;
        } else {
          patch.toSide = side;
          patch.toAt = at;
        }
        patches.set(item.edgeId, patch);
      });
      ends += list.length;
      sides += 1;
    }
  }
  return {
    patches: [...patches.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([edgeId, patch]) => ({ edgeId, patch })),
    ends,
    sides,
  };
}

/** The route patches that spread the ends on every side of `cardIds` (cards or groups). */
export function spreadEnds(view: SpreadView, cardIds: readonly Id[]): SpreadPatch[] {
  return spreadEndsPlan(view, cardIds).patches;
}
