/**
 * Placement of an imported flowchart: the layout request for the ELK worker, and the positions and
 * group frames written back into the file before it is stored. Main thread; the layout itself runs
 * in the layout worker.
 */
import { fitGroupFrames } from '@sododeck/model';
import type { Id, Node, SododeckFile } from '@sododeck/schema';

import { GROUP_PADDING } from '../editor/canvas-geometry';
import type { LayoutRequest, LayoutResult } from '../layout/elk-layout';
import { defaultSize } from './shape-map';
import type { FlowDirection } from './parse-flowchart';

const ELK_DIRECTION = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
} as const satisfies Record<FlowDirection, NonNullable<LayoutRequest['direction']>>;

const sizeOf = (node: Node) => node.size ?? defaultSize(node.type);

export function toLayoutRequest(file: SododeckFile, direction: FlowDirection): LayoutRequest {
  const groupIds = new Set(file.groups.map((g) => g.id));
  // An end may be a group frame: the layout names it `group:<id>`.
  const end = (id: Id) => (groupIds.has(id) ? `group:${id}` : id);
  return {
    nodes: file.nodes.map((node) => ({
      id: node.id,
      ...sizeOf(node),
      ...(node.group === undefined ? {} : { parent: node.group }),
    })),
    groups: file.groups.map((g) =>
      g.parent === undefined ? { id: g.id } : { id: g.id, parent: g.parent },
    ),
    edges: file.edges.map((e) => ({ id: e.id, source: end(e.from), target: end(e.to) })),
    pinned: {},
    direction: ELK_DIRECTION[direction],
  };
}

/** Writes the layout's positions into the nodes and fits a frame around every non-empty group. */
export function applyLayout(file: SododeckFile, result: LayoutResult): SododeckFile {
  const nodes = file.nodes.map((node, index) => ({
    ...node,
    // A node the layout missed (it should not happen) still gets a distinct grid cell.
    position: result[node.id] ?? { x: (index % 6) * 260, y: Math.floor(index / 6) * 160 },
  }));
  const frames = fitGroupFrames(
    { nodes, groups: file.groups.map(({ position: _p, size: _s, ...g }) => g), views: [] },
    { cardSize: defaultSize('rectangle'), sizeOf, padding: GROUP_PADDING },
  );
  return {
    ...file,
    nodes,
    groups: file.groups.map((group) => {
      const frame = frames.get(group.id);
      return frame === undefined ? group : { ...group, position: frame.position, size: frame.size };
    }),
  };
}
