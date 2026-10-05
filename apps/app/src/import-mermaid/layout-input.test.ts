// @vitest-environment node
import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';

import { computeLayout } from '../layout/elk-layout';
import { prepare } from './detect';
import { flowchartToDeck } from './flowchart-to-deck';
import { applyLayout, toLayoutRequest } from './layout-input';
import { parseFlowchart, type FlowDirection } from './parse-flowchart';

const elk = new ELK();

async function place(text: string) {
  const parsed = parseFlowchart(prepare(text));
  const { file } = flowchartToDeck(parsed);
  const request = toLayoutRequest(file, parsed.direction);
  const result = await computeLayout(request, elk);
  return { file, request, placed: applyLayout(file, result) };
}

type Box = { x: number; y: number; width: number; height: number };
const boxOf = (node: {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}): Box => ({
  x: node.position?.x ?? 0,
  y: node.position?.y ?? 0,
  width: node.size?.width ?? 0,
  height: node.size?.height ?? 0,
});
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('toLayoutRequest', () => {
  it('describes nodes with registry sizes, groups as compounds and the connections', async () => {
    const { file, request } = await place('flowchart LR\nsubgraph g [G]\nA{x}\nend\nA --> B');
    const group = file.groups[0]?.id;
    expect(request.nodes[0]).toMatchObject({ width: 176, height: 112, parent: group });
    expect(request.nodes[1]?.parent).toBeUndefined();
    expect(request.groups).toEqual([{ id: group }]);
    expect(request.edges).toHaveLength(1);
    expect(request.pinned).toEqual({});
  });

  it('names a group end group:<id>', async () => {
    const { file, request } = await place('flowchart LR\nsubgraph g [G]\nA\nend\nX --> g');
    expect(request.edges[0]?.target).toBe(`group:${file.groups[0]?.id}`);
  });

  it.each([
    ['TB', 'DOWN'],
    ['BT', 'UP'],
    ['LR', 'RIGHT'],
    ['RL', 'LEFT'],
  ] as [FlowDirection, string][])('%s → %s', async (direction, elkDirection) => {
    const { file } = await place('flowchart LR\nA --> B');
    expect(toLayoutRequest(file, direction).direction).toBe(elkDirection);
  });
});

describe('applyLayout', () => {
  it.each([
    ['LR', 'x', 1],
    ['RL', 'x', -1],
    ['TD', 'y', 1],
    ['BT', 'y', -1],
  ] as const)('direction %s advances along %s', async (dir, axis, sign) => {
    const { placed } = await place(`flowchart ${dir}\nA --> B`);
    const [a, b] = placed.nodes;
    expect(Math.sign((b?.position?.[axis] ?? 0) - (a?.position?.[axis] ?? 0))).toBe(sign);
  });

  it('fits a group frame around its members, and a nested frame inside its parent', async () => {
    const { placed } = await place(
      'flowchart LR\nsubgraph o [Outer]\nsubgraph i [Inner]\nA --> B\nend\nC\nend\nB --> D',
    );
    const [outer, inner] = placed.groups;
    expect(outer?.position).toBeDefined();
    const members = placed.nodes.filter((n) => n.group === inner?.id).map(boxOf);
    for (const m of members) {
      expect(m.x).toBeGreaterThanOrEqual(inner?.position?.x ?? 0);
      expect(m.x + m.width).toBeLessThanOrEqual(
        (inner?.position?.x ?? 0) + (inner?.size?.width ?? 0),
      );
    }
    const innerBox = boxOf(inner ?? {});
    const outerBox = boxOf(outer ?? {});
    expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x);
    expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y);
    expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width);
    expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height);
  });

  it('leaves no two components overlapping in a 30-node, 2-subgraph graph', async () => {
    const lines = ['flowchart TD', 'subgraph s1 [One]'];
    for (let i = 0; i < 12; i++) lines.push(`N${i}[Node ${i}] --> N${i + 1}`);
    lines.push('end', 'subgraph s2 [Two]');
    for (let i = 13; i < 25; i++) lines.push(`N${i}{Check ${i}} --> N${i + 1}`);
    lines.push('end', 'N25 --> N26', 'N26 --> N27', 'N27 --> N28', 'N28 --> N29', 'N12 --> N13');
    const started = performance.now();
    const { placed } = await place(lines.join('\n'));
    expect(performance.now() - started).toBeLessThan(3000);
    expect(placed.nodes).toHaveLength(30);
    expect(placed.groups).toHaveLength(2);
    const boxes = placed.nodes.map(boxOf);
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(overlap(a, b)).toBe(false);
    }
  });
});
