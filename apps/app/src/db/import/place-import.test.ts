import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';

import { cardSize, type Rect } from '../../editor/canvas-geometry';
import { tableContextOf } from '../../editor/table-keys';
import { computeLayout } from '../../layout/elk-layout';
import { CORPUS } from '../fixtures/import/corpus';
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import { CLUSTER_GAP, placeImport } from './place-import';
import type { ImportTarget } from './types';

const TARGET: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};
const elk = new ELK();
const runLayout = (request: Parameters<typeof computeLayout>[0]) => computeLayout(request, elk);

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function planOf(file: keyof typeof CORPUS) {
  const { plan } = await runImport(
    { text: CORPUS[file], format: 'auto', dialect: 'auto', detectFk: false },
    TARGET,
    createParsers(),
  );
  return plan;
}

function rectsOf(
  plan: Awaited<ReturnType<typeof planOf>>,
  positions: Record<string, { x: number; y: number }>,
): Rect[] {
  const table = tableContextOf(plan.fragment.deck);
  return plan.fragment.deck.nodes.map((n) => ({
    ...(positions[n.id] ?? { x: 0, y: 0 }),
    ...cardSize(n, undefined, { table }),
  }));
}

describe('placeImport (research R7, FR-018, FR-019)', () => {
  it('lays out the 30-table dump with no two tables overlapping (SC-001)', async () => {
    const plan = await planOf('pg-30-tables.sql');
    const { positions } = await placeImport(plan, runLayout, []);
    const rects = rectsOf(plan, positions);
    expect(rects).toHaveLength(30);
    for (let i = 0; i < rects.length; i++) {
      for (let k = i + 1; k < rects.length; k++)
        expect(overlaps(rects[i] as Rect, rects[k] as Rect)).toBe(false);
    }
    expect(Math.min(...rects.map((r) => r.x))).toBe(0);
  });

  it('places the cluster beside existing content without overlapping it', async () => {
    const plan = await planOf('mysql-dump.sql');
    const existing: Rect[] = [
      { x: -100, y: 50, width: 184, height: 120 },
      { x: 400, y: 300, width: 184, height: 120 },
    ];
    const { positions } = await placeImport(plan, runLayout, existing);
    const rects = rectsOf(plan, positions);
    expect(Math.min(...rects.map((r) => r.x))).toBe(400 + 184 + CLUSTER_GAP);
    expect(Math.min(...rects.map((r) => r.y))).toBe(50);
    for (const rect of rects) for (const old of existing) expect(overlaps(rect, old)).toBe(false);
  });

  it('frames groups around their members and puts stickies under the cluster', async () => {
    const plan = await planOf('extras.dbml');
    const { positions, frames, stickies } = await placeImport(plan, runLayout, []);
    const [group] = plan.fragment.deck.groups;
    const frame = group === undefined ? undefined : frames[group.id];
    expect(frame).toBeDefined();
    const rects = rectsOf(plan, positions);
    const members = plan.fragment.deck.nodes.flatMap((n, i) =>
      n.group === group?.id ? [rects[i] as Rect] : [],
    );
    for (const m of members) {
      expect(m.x).toBeGreaterThanOrEqual(frame?.position.x ?? Infinity);
      expect(m.x + m.width).toBeLessThanOrEqual(
        (frame?.position.x ?? 0) + (frame?.size.width ?? 0),
      );
    }
    const bottom = Math.max(...rects.map((r) => r.y + r.height));
    expect(stickies).toHaveLength(1);
    expect(stickies[0]?.y).toBeGreaterThan(bottom);
  });
});
