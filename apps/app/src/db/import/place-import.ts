/**
 * Placement of an import (044 research R7, FR-018, FR-019): the imported tables alone are laid out
 * by the deck's auto-layout (ELK, in its worker), clustered by group, then moved beside the
 * target's existing content so nothing existing moves and nothing overlaps. Main thread, before
 * anything is written; the layout runs elsewhere.
 */
import { fitGroupFrames, type Point } from '@sododeck/model';
import type { Frame, Id, Node } from '@sododeck/schema';

import { cardSize, GROUP_PADDING, type Rect } from '../../editor/canvas-geometry';
import { tableContextOf } from '../../editor/table-keys';
import type { LayoutRequest, LayoutResult } from '../../layout/elk-layout';
import type { ImportPlan } from './types';

/** Gap between the existing content and the imported cluster. */
export const CLUSTER_GAP = 160;
/** Gap between the cluster and the stickies under it. */
const STICKY_GAP = 48;
/** Horizontal step between stickies (a note is 200 wide). */
const STICKY_STEP = 224;

export interface Placement {
  /** Top-left of every imported table, by plan id. */
  positions: Record<Id, Point>;
  /** Frames of the imported groups, by plan id. */
  frames: Record<Id, Frame>;
  /** Positions of the plan's stickies, in order. */
  stickies: Point[];
}

export type RunLayout = (request: LayoutRequest) => Promise<LayoutResult>;

/** The layout request for the plan's tables, groups and relationships. */
export function importLayoutRequest(plan: ImportPlan): LayoutRequest {
  const { deck } = plan.fragment;
  const table = tableContextOf(deck);
  return {
    nodes: deck.nodes.map((node) => ({
      id: node.id,
      ...cardSize(node, undefined, { table }),
      ...(node.group === undefined ? {} : { parent: node.group }),
    })),
    groups: deck.groups.map((g) =>
      g.parent === undefined ? { id: g.id } : { id: g.id, parent: g.parent },
    ),
    edges: deck.edges
      .filter((e) => e.from !== e.to)
      .map((e) => ({ id: e.id, source: e.from, target: e.to })),
    pinned: {},
  };
}

export async function placeImport(
  plan: ImportPlan,
  runLayout: RunLayout,
  existing: readonly Rect[],
): Promise<Placement> {
  const { deck } = plan.fragment;
  const table = tableContextOf(deck);
  const sizeOf = (node: Node) => cardSize(node, undefined, { table });
  const result = deck.nodes.length === 0 ? {} : await runLayout(importLayoutRequest(plan));

  const raw = new Map<Id, Point>();
  deck.nodes.forEach((node, i) => {
    raw.set(node.id, result[node.id] ?? { x: (i % 6) * 260, y: Math.floor(i / 6) * 260 });
  });
  const boxes = deck.nodes.map((node) => {
    const at = raw.get(node.id) ?? { x: 0, y: 0 };
    const size = sizeOf(node);
    return { left: at.x, top: at.y, right: at.x + size.width, bottom: at.y + size.height };
  });
  // Group frames reach past their members by the padding (more on top, for the title).
  const pad = deck.groups.length > 0 ? GROUP_PADDING : 0;
  const left = boxes.length === 0 ? 0 : Math.min(...boxes.map((b) => b.left)) - pad;
  const top = boxes.length === 0 ? 0 : Math.min(...boxes.map((b) => b.top)) - pad * 2;

  const origin =
    existing.length === 0
      ? { x: 0, y: 0 }
      : {
          x: Math.max(...existing.map((r) => r.x + r.width)) + CLUSTER_GAP,
          y: Math.min(...existing.map((r) => r.y)),
        };
  const dx = origin.x - left;
  const dy = origin.y - top;

  const positions: Record<Id, Point> = {};
  for (const [id, at] of raw)
    positions[id] = { x: Math.round(at.x + dx), y: Math.round(at.y + dy) };

  const placed = {
    nodes: deck.nodes.map((n) => ({ ...n, position: positions[n.id] ?? { x: 0, y: 0 } })),
    groups: deck.groups,
    views: [],
  };
  const frames: Record<Id, Frame> = {};
  for (const [id, frame] of fitGroupFrames(placed, {
    cardSize: { width: 184, height: 128 },
    sizeOf,
    padding: GROUP_PADDING,
  })) {
    frames[id] = frame;
  }

  const bottoms = [
    ...placed.nodes.map((n) => n.position.y + sizeOf(n).height),
    ...Object.values(frames).map((f) => f.position.y + f.size.height),
  ];
  const lefts = [
    ...placed.nodes.map((n) => n.position.x),
    ...Object.values(frames).map((f) => f.position.x),
  ];
  const stickyTop = (bottoms.length === 0 ? origin.y : Math.max(...bottoms)) + STICKY_GAP;
  const stickyLeft = lefts.length === 0 ? origin.x : Math.min(...lefts);
  const stickies = plan.stickies.map((_, i) => ({ x: stickyLeft + i * STICKY_STEP, y: stickyTop }));
  return { positions, frames, stickies };
}
