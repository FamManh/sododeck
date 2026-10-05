/**
 * What a dragged connector end (or a new connection) would attach to (050 R4). Pure: the scene is
 * built from the flow nodes the canvas draws, so it is right for views, drill-in, collapsed groups
 * and semantic zoom, and anything not drawn (hidden, out of scope) can't be hit.
 *
 * - Cards first (component cards, shapes and collapsed-group cards): one the pointer is inside,
 *   topmost in paint order, else the nearest within `TARGET_REACH` screen px.
 * - Notes (053) next: the pointer inside a note beats a card that is only within reach, and a
 *   card within reach beats a note within reach.
 * - Otherwise the innermost group frame that contains the point or whose frame edge is within
 *   reach. A card always wins over the group it sits in (spec edge case).
 *
 * Groups are connector ends (050 R6); a caller can still leave them out (`allowGroups`).
 */
import type { Geometry } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX, STICKY_NODE_PREFIX } from '../deck-to-flow';
import { attachToOutline, type Attachment } from './outline-attach';
import type { Box, Point } from './route-path';

/** Attach reach around a target's outline, in screen px (FR-009). */
export const TARGET_REACH = 16;

/** Whether a connector end may be dropped on a group by default (on since 050 T030). */
export const GROUP_ENDS = true;

export interface EndpointTarget {
  /** The card's node id, the group id (for a frame or a collapsed-group card) or the note's id. */
  id: Id;
  kind: 'node' | 'group' | 'sticky';
  /** The React Flow node that draws it (`group:` / `collapsed:` / `sticky:` prefixed). */
  flowId: string;
  box: Box;
  /** A shape card's outline (031). */
  geometry?: Geometry;
}

export interface TargetScene {
  /** Cards, bottom first (paint order). */
  cards: readonly EndpointTarget[];
  /** Notes (053), bottom first. */
  stickies: readonly EndpointTarget[];
  /** Group frames as drawn. */
  groups: readonly EndpointTarget[];
}

/** The parts of a drawn React Flow node the scene reads. */
export interface SceneNode {
  id: string;
  type?: string | undefined;
  position: Point;
  width?: number | undefined;
  height?: number | undefined;
  measured?: { width?: number | undefined; height?: number | undefined } | undefined;
  hidden?: boolean | undefined;
  zIndex?: number | undefined;
  data: Record<string, unknown>;
}

/** Every geometry name, so a node's `data.geometry` can be narrowed (kept in step by the type). */
const GEOMETRY_NAMES: Record<Geometry, true> = {
  rect: true,
  'rounded-rect': true,
  ellipse: true,
  diamond: true,
  stadium: true,
  cylinder: true,
  document: true,
  parallelogram: true,
  hexagon: true,
  actor: true,
  none: true,
};

function isGeometry(value: unknown): value is Geometry {
  return typeof value === 'string' && Object.hasOwn(GEOMETRY_NAMES, value);
}

function boxOf(node: SceneNode): Box | null {
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  if (width === undefined || height === undefined) return null;
  return { x: node.position.x, y: node.position.y, width, height };
}

/** Builds the scene from the drawn flow nodes (`getNodes()`), in their paint order. */
export function targetScene(nodes: readonly SceneNode[]): TargetScene {
  const cards: { target: EndpointTarget; z: number; index: number }[] = [];
  const groups: EndpointTarget[] = [];
  const stickies: EndpointTarget[] = [];
  nodes.forEach((node, index) => {
    if (node.hidden === true) return;
    const box = boxOf(node);
    if (box === null) return;
    const z = node.zIndex ?? 0;
    switch (node.type) {
      case 'deck':
      case 'shape': {
        const geometry = node.data.geometry;
        cards.push({
          target: {
            id: node.id,
            kind: 'node',
            flowId: node.id,
            box,
            ...(isGeometry(geometry) ? { geometry } : {}),
          },
          z,
          index,
        });
        return;
      }
      case 'collapsed-group': {
        if (!node.id.startsWith(COLLAPSED_NODE_PREFIX)) return;
        const id = node.id.slice(COLLAPSED_NODE_PREFIX.length);
        cards.push({ target: { id, kind: 'group', flowId: node.id, box }, z, index });
        return;
      }
      case 'group-boundary': {
        if (!node.id.startsWith(GROUP_NODE_PREFIX)) return;
        groups.push({
          id: node.id.slice(GROUP_NODE_PREFIX.length),
          kind: 'group',
          flowId: node.id,
          box,
        });
        return;
      }
      case 'sticky': {
        if (!node.id.startsWith(STICKY_NODE_PREFIX)) return;
        stickies.push({
          id: node.id.slice(STICKY_NODE_PREFIX.length),
          kind: 'sticky',
          flowId: node.id,
          box,
        });
        return;
      }
      default:
        // Port pills (out-of-scope proxies) and scope labels are never ends.
        return;
    }
  });
  cards.sort((a, b) => a.z - b.z || a.index - b.index);
  return { cards: cards.map((c) => c.target), stickies, groups };
}

/** Distance from `p` to the box: 0 inside. */
function distanceToBox(box: Box, p: Point): number {
  const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.width));
  const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

/** The topmost of `list` (painted bottom first) that contains `point`. */
function containing(list: readonly EndpointTarget[], point: Point): EndpointTarget | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const target = list[i];
    if (target !== undefined && distanceToBox(target.box, point) === 0) return target;
  }
  return null;
}

/** The nearest of `list` within `reach`; on a tie the one painted on top stays. */
function nearest(
  list: readonly EndpointTarget[],
  point: Point,
  reach: number,
): EndpointTarget | null {
  let near: EndpointTarget | null = null;
  let nearDistance = Infinity;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const target = list[i];
    if (target === undefined) continue;
    const d = distanceToBox(target.box, point);
    if (d <= reach && d < nearDistance) {
      near = target;
      nearDistance = d;
    }
  }
  return near;
}

/**
 * The target under `point`: a card the pointer is inside, then a note it is inside, then the
 * nearest card within reach, the nearest note within reach, else the innermost group frame
 * containing or near `point`.
 */
export function hitTarget(point: Point, scene: TargetScene, zoom: number): EndpointTarget | null {
  const reach = TARGET_REACH / (zoom > 0 ? zoom : 1);
  const hit =
    containing(scene.cards, point) ??
    containing(scene.stickies, point) ??
    nearest(scene.cards, point, reach) ??
    nearest(scene.stickies, point, reach);
  if (hit !== null) return hit;
  let group: EndpointTarget | null = null;
  for (const target of scene.groups) {
    if (distanceToBox(target.box, point) > reach) continue;
    // Nested frames sit inside their parents, so the smallest one is the innermost.
    if (group === null || target.box.width * target.box.height < group.box.width * group.box.height)
      group = target;
  }
  return group;
}

/**
 * Where a **new** connection dragged from `fromId` would land at `point` (050 T021): the target
 * under the pointer, skipping the card or frame it starts from (and groups with `allowGroups` off),
 * and the attachment on its outline. Shared by the live connection line and the drop.
 */
export function connectTarget(
  scene: TargetScene,
  fromId: string,
  point: Point,
  opts: { zoom: number; mod: boolean; allowGroups?: boolean },
): { target: EndpointTarget; attach: Attachment } | null {
  const target = hitTarget(point, scene, opts.zoom);
  if (target === null || target.flowId === fromId) return null;
  if (target.kind === 'group' && !(opts.allowGroups ?? GROUP_ENDS)) return null;
  const attach = attachToOutline(target.box, target.geometry, point, {
    zoom: opts.zoom,
    mod: opts.mod,
    allowAutomatic: false,
  });
  return { target, attach };
}
