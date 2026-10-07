import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { applyFile, loadDeck, prepareDeck, serializeDeck, type DeckDoc } from '../src';
import { COLLECTIONS } from '../src/layout';
import { largeDeck, perTypeDecks, readExample, shopDeck } from './helpers';
import { picture } from './image-helpers';

const origin = { test: 'round-trip' };

function imagesDeck(): SododeckFile {
  const [a, b] = [picture(1), picture(2)];
  return {
    ...emptySododeckFile(),
    nodes: [{ id: 'n', type: 'service', title: 'N' }],
    images: [
      { id: 'img-a', asset: a.id, position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
      {
        id: 'img-b',
        asset: b.id,
        position: { x: 50, y: 0 },
        size: { width: 40, height: 40 },
        alt: 'Second',
        crop: { x: 0, y: 0, width: 0.5, height: 1 },
      },
    ],
    edges: [{ id: 'e', from: 'n', to: 'img-a' }],
    assets: {
      [a.id]: { ...a.meta, data: a.data },
      [b.id]: { ...b.meta, data: b.data },
    },
  };
}

const corpus: [string, SododeckFile][] = [
  ['empty', emptySododeckFile()],
  ['minimal', await readExample('minimal.sododeck.json')],
  ['flow-and-rule', await readExample('flow-and-rule.sododeck.json')],
  ['full', await readExample('full.sododeck.json')],
  ...perTypeDecks,
  ['shop', shopDeck()],
  ['images', imagesDeck()],
  ['large (small)', largeDeck({ nodes: 30, edges: 50, flows: 3, stepsPerFlow: 4, rules: 2 })],
];

function expectApplied(doc: DeckDoc, file: SododeckFile): void {
  const result = applyFile(doc, file, origin);
  expect(result.status).toBe('applied');
  expect(serializeDeck(doc)).toBe(serializeDeck(loadDeck(file).doc));
}

describe('applyFile round trip over the corpus (066 SC-001, FR-014)', () => {
  it.each(corpus)('from %s to every deck: reads exactly as loading the target', (_, from) => {
    for (const [, to] of corpus) {
      const { doc } = loadDeck(from);
      expectApplied(doc, to);
    }
  });
});

/** A small deterministic generator (LCG), so a failure always replays. */
function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(list: readonly T[]): T | undefined => list[int(list.length)];
  return { int, pick };
}

type Edit = (file: SododeckFile, n: number) => void;

function swap(list: unknown[] | undefined, rand: ReturnType<typeof random>): void {
  if (list === undefined || list.length < 2) return;
  const i = rand.int(list.length);
  const j = rand.int(list.length);
  const a = list[i];
  const b = list[j];
  if (a === undefined || b === undefined) return;
  list[i] = b;
  list[j] = a;
}

function edits(rand: ReturnType<typeof random>): Edit[] {
  const tables = (file: SododeckFile) => file.nodes.filter((node) => node.columns !== undefined);
  const rules = (file: SododeckFile) => Object.values(file.rules);
  return [
    (file, n) => {
      const node = rand.pick(file.nodes);
      if (node !== undefined) node.title = `Title ${String(n)}`;
    },
    (file, n) => {
      const node = rand.pick(file.nodes);
      if (node !== undefined) node.position = { x: n * 3, y: n % 17 };
    },
    (file) => {
      swap(file.nodes, rand);
    },
    (file) => {
      swap(file.edges, rand);
    },
    (file) => {
      swap(file.views, rand);
    },
    (file) => {
      swap(file.stickies, rand);
    },
    (file) => {
      swap(rand.pick(file.flows)?.steps, rand);
    },
    (file) => {
      swap(rand.pick(rules(file))?.rows, rand);
    },
    (file) => {
      swap(rand.pick(tables(file))?.columns, rand);
    },
    (file) => {
      swap(file.fields, rand);
    },
    (file) => {
      swap(rand.pick(file.enums ?? [])?.values, rand);
    },
    (file, n) => {
      file.nodes.push({ id: `gen-node-${String(n)}`, type: 'service', title: `New ${String(n)}` });
    },
    (file) => {
      const generated = file.nodes.filter((node) => node.id.startsWith('gen-node-'));
      const gone = rand.pick(generated);
      if (gone !== undefined) file.nodes = file.nodes.filter((node) => node !== gone);
    },
    (file, n) => {
      const rule = rand.pick(rules(file));
      const row = rand.pick(rule?.rows ?? []);
      if (row !== undefined && row.when.length > 0)
        row.when[rand.int(row.when.length)] = `>${String(n)}`;
    },
    (file, n) => {
      const rule = rand.pick(rules(file));
      rule?.rows.push({
        id: `gen-row-${String(n)}`,
        when: rule.inputs.map(() => ''),
        then: rule.outputs.map(() => 'x'),
      });
    },
    (file) => {
      for (const rule of rules(file))
        rule.rows = rule.rows.filter((r) => !r.id.startsWith('gen-row-'));
    },
    (file, n) => {
      const rule = rand.pick(rules(file));
      if (rule === undefined) return;
      rule.inputs.push({ id: `gen-in-${String(n)}`, label: `In ${String(n)}` });
      for (const row of rule.rows) row.when.push('');
    },
    (file) => {
      for (const rule of rules(file)) {
        const at = rule.inputs.findIndex((column) => column.id.startsWith('gen-in-'));
        if (at === -1) continue;
        rule.inputs.splice(at, 1);
        for (const row of rule.rows) row.when.splice(at, 1);
      }
    },
    (file, n) => {
      const step = rand.pick(rand.pick(file.flows)?.steps ?? []);
      if (step !== undefined) step.description = n % 3 === 0 ? '' : `Step text ${String(n)}`;
    },
    (file, n) => {
      const flow = rand.pick(file.flows);
      const edge = rand.pick(file.edges);
      if (flow !== undefined && edge !== undefined && flow.branches === undefined) {
        flow.steps.push({ id: `gen-step-${String(n)}`, edge: edge.id });
      }
    },
    (file) => {
      for (const flow of file.flows)
        flow.steps = flow.steps.filter((s) => !s.id.startsWith('gen-step-'));
    },
    (file, n) => {
      const column = rand.pick(rand.pick(tables(file))?.columns ?? []);
      if (column !== undefined) column.note = `Note ${String(n)}`;
    },
    (file, n) => {
      const view = rand.pick(file.views);
      if (view === undefined) return;
      view.title = `View ${String(n)}`;
      const node = rand.pick(file.nodes);
      if (node !== undefined) view.positions = { ...view.positions, [node.id]: { x: n, y: n } };
    },
    (file, n) => {
      const sticky = rand.pick(file.stickies);
      if (sticky !== undefined) sticky.text = `Sticky ${String(n)}`;
    },
    (file, n) => {
      if (n % 2 === 0) delete file.name;
      else file.name = `Deck ${String(n)}`;
    },
    (file, n) => {
      file.swatches = n % 2 === 0 ? [] : ['#123456', `#0000${String(10 + (n % 80))}`];
    },
    (file, n) => {
      file.description = `About ${String(n)}`;
    },
    (file, n) => {
      const node = rand.pick(file.nodes);
      if (node !== undefined) node.style = n % 2 === 0 ? { fill: '#ffeedd' } : undefined;
    },
  ];
}

describe('applyFile on generated edits (066 SC-001)', () => {
  it('stays equal to a fresh load and keeps the stored map of every kept id', async () => {
    const rand = random(66);
    const list = edits(rand);
    let file = await readExample('full.sododeck.json');
    const { doc } = loadDeck(file);
    let applied = 0;
    for (let round = 0; round < 200; round++) {
      const candidate = structuredClone(file);
      const count = 1 + rand.int(5);
      for (let i = 0; i < count; i++) list[rand.int(list.length)]?.(candidate, round * 10 + i);
      try {
        prepareDeck(candidate);
      } catch {
        continue; // An edit made an invalid file: skip it, as a host would get it refused.
      }
      const before = new Map(
        COLLECTIONS.flatMap((c) =>
          [...doc.getMap(c).entries()].map(([id, map]) => [`${c}/${id}`, map]),
        ),
      );
      expectApplied(doc, candidate);
      for (const c of COLLECTIONS) {
        for (const [id, map] of doc.getMap(c).entries()) {
          const was = before.get(`${c}/${id}`);
          if (was !== undefined) expect(map).toBe(was);
        }
      }
      file = candidate;
      applied++;
    }
    expect(applied).toBeGreaterThan(150);
  });
});
