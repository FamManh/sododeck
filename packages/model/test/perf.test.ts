import { describe, expect, it } from 'vitest';

import {
  applyFile,
  buildSearchIndex,
  checkDeck,
  checkIntegrity,
  createDeckSnapshot,
  createEditor,
  fromJSON,
  searchDeck,
  observeDeck,
  serializeDeck,
  toJSON,
} from '../src';
import { largeDeck, largeSchemaDeck } from './helpers';

// SC-003/004 on 500 nodes / 1,000 edges / 20 flows × 10 steps / 10 rules. Shared CI runners are
// slower and noisier than a laptop, so budgets are multiplied by 3 there. If a budget fails,
// profile first; do not raise the numbers without reporting it.
const SLACK = process.env.CI ? 3 : 1;
const LOAD_BUDGET_MS = 200 * SLACK;
const EDIT_BUDGET_MS = 16 * SLACK;
// 003 research R1: a drag writes one position per frame and the canvas re-reads the snapshot.
const SNAPSHOT_BUDGET_MS = 2 * SLACK;
const SEARCH_BUDGET_MS = 50 * SLACK;
const SEARCH_INDEX_BUDGET_MS = 100 * SLACK;
// 015: the problems worker checks a fresh structured clone on every edit, so caches are cold.
const CHECK_DECK_BUDGET_MS = 30 * SLACK;
// 036 SC-005: lookups by id, so a field edit does not grow with the deck; a move is one key.
const BIG_EDIT_BUDGET_MS = 1 * SLACK;
const BIG_MOVE_BUDGET_MS = 10 * SLACK;
// 040 SC-005: a 150-table schema (12 columns each, 200 relationships) loads and saves in < 1 s.
const SCHEMA_LOAD_BUDGET_MS = 1000 * SLACK;
// 066 SC-003: applying a changed file, validation included.
const APPLY_ONE_BUDGET_MS = 50 * SLACK;
const APPLY_ALL_BUDGET_MS = 1000 * SLACK;

function cpuMs(run: () => void): number {
  const start = process.cpuUsage();
  run();
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000;
}

/** Median of 5 timed runs after 1 warm-up. */
function median(run: () => void): number {
  run();
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    times.push(cpuMs(run));
  }
  times.sort((a, b) => a - b);
  return times[2] ?? Infinity;
}

const file = largeDeck();
const doc = fromJSON(file);
const out = toJSON(doc);
const timings: Record<string, number> = {};
const searchFile = largeDeck({
  nodes: 2000,
  edges: 4000,
  flows: 80,
  stepsPerFlow: 10,
  rules: 40,
  stickies: 200,
});

describe('performance on a large deck (SC-003, SC-004)', () => {
  it('builds the deck it measures', () => {
    expect(file.nodes).toHaveLength(500);
    expect(file.edges).toHaveLength(1000);
    expect(out).toEqual(file);
  });

  it.each([
    ['fromJSON', () => fromJSON(file)],
    ['toJSON', () => toJSON(doc)],
    ['serializeDeck(toJSON)', () => serializeDeck(toJSON(doc))],
    ['checkIntegrity', () => checkIntegrity(out)],
  ])(`%s takes < ${String(LOAD_BUDGET_MS)} ms`, (name, run) => {
    timings[name] = median(run);
    expect(timings[name]).toBeLessThan(LOAD_BUDGET_MS);
  });

  it(`applies and observes a single rename or move in < ${String(EDIT_BUDGET_MS)} ms`, () => {
    const editor = createEditor(doc);
    let observed = 0;
    const stop = observeDeck(doc, () => observed++);
    let i = 0;
    timings.rename = median(() => {
      editor.update('nodes', 'n499', { title: `Renamed ${String(i++)}` });
    });
    timings.move = median(() => {
      editor.update('nodes', 'n499', { position: { x: i, y: i++ } });
    });
    timings['rename last edge'] = median(() => {
      editor.update('edges', 'e999', { label: `Label ${String(i++)}` });
    });
    stop();
    expect(observed).toBe(18);
    expect(timings.rename).toBeLessThan(EDIT_BUDGET_MS);
    expect(timings.move).toBeLessThan(EDIT_BUDGET_MS);
    expect(timings['rename last edge']).toBeLessThan(EDIT_BUDGET_MS);
  });

  it(`edits one of 10,000 components in ≤ 2× the 500-component time, moves one in < ${String(BIG_MOVE_BUDGET_MS)} ms (036 SC-005)`, () => {
    const big = fromJSON(
      largeDeck({ nodes: 10_000, edges: 20_000, flows: 20, stepsPerFlow: 10, rules: 10 }),
    );
    const editor = createEditor(big);
    let i = 0;
    timings['rename at 10k'] = median(() => {
      editor.update('nodes', 'n9999', { title: `Renamed ${String(i++)}` });
    });
    timings['reorder at 10k'] = median(() => {
      editor.reorder('nodes', i++ % 2 === 0 ? 'n9999' : 'n0', i % 2 === 0 ? 0 : 9_999);
    });
    editor.destroy();
    expect(timings['rename at 10k']).toBeLessThan(BIG_EDIT_BUDGET_MS);
    expect(timings['rename at 10k']).toBeLessThanOrEqual(Math.max(2 * (timings.rename ?? 0), 0.1));
    expect(timings['reorder at 10k']).toBeLessThan(BIG_MOVE_BUDGET_MS);
  });

  it(`moves a node and updates the incremental snapshot in < ${String(SNAPSHOT_BUDGET_MS)} ms`, () => {
    const editor = createEditor(doc);
    const snapshot = createDeckSnapshot(doc);
    let i = 0;
    timings['move + snapshot'] = median(() => {
      editor.update('nodes', 'n250', { position: { x: i, y: i++ } });
      snapshot.get();
    });
    expect(snapshot.get()).toEqual(toJSON(doc));
    snapshot.destroy();
    editor.destroy();
    expect(timings['move + snapshot']).toBeLessThan(SNAPSHOT_BUDGET_MS);
    console.info(
      'perf (median ms):',
      Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Number(v.toFixed(2))])),
    );
  });

  it(`searches a 2,000-node deck in < ${String(SEARCH_BUDGET_MS)} ms (measured at 2026-09-27: 8 ms locally)`, () => {
    const index = buildSearchIndex(searchFile);
    timings.search = median(() => {
      searchDeck(index, 'service 1999');
    });
    expect(searchDeck(index, 'service 1999').results[0]?.id).toBe('n1999');
    expect(timings.search).toBeLessThan(SEARCH_BUDGET_MS);
  });

  it(`builds a cold search index in < ${String(SEARCH_INDEX_BUDGET_MS)} ms (measured at 2026-09-27: 32 ms locally)`, () => {
    buildSearchIndex(structuredClone(searchFile)); // warm-up on a fresh object identity
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const fresh = structuredClone(searchFile);
      times.push(cpuMs(() => buildSearchIndex(fresh)));
    }
    times.sort((a, b) => a - b);
    timings['search index'] = times[2] ?? Infinity;
    expect(timings['search index']).toBeLessThan(SEARCH_INDEX_BUDGET_MS);
  });

  it(`checks a cold 2,000-node deck for problems in < ${String(CHECK_DECK_BUDGET_MS)} ms (measured at 2026-09-28: 8 ms locally)`, () => {
    checkDeck(structuredClone(searchFile)); // warm-up (JIT), on a fresh object identity
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const fresh = structuredClone(searchFile);
      times.push(cpuMs(() => checkDeck(fresh)));
    }
    times.sort((a, b) => a - b);
    timings.checkDeck = times[2] ?? Infinity;
    expect(checkDeck(searchFile).total).toBeGreaterThan(0);
    expect(timings.checkDeck).toBeLessThan(CHECK_DECK_BUDGET_MS);
  });

  it(`loads and saves a 150-table schema in < ${String(SCHEMA_LOAD_BUDGET_MS)} ms each, edits a column in < ${String(BIG_EDIT_BUDGET_MS)} ms (040 SC-005)`, () => {
    const schema = largeSchemaDeck(150, 12, 200);
    let loaded = fromJSON(schema);
    timings['schema fromJSON'] = median(() => {
      loaded = fromJSON(schema);
    });
    timings['schema toJSON'] = median(() => {
      toJSON(loaded);
    });
    const editor = createEditor(loaded);
    let i = 0;
    timings['schema column edit'] = median(() => {
      editor.updateColumn('t149', 't149c5', { name: `renamed_${String(i++)}` });
    });
    editor.destroy();
    const plain = toJSON(loaded);
    checkDeck(structuredClone(plain)); // warm-up on a fresh object identity
    const times: number[] = [];
    for (let k = 0; k < 5; k++) {
      const fresh = structuredClone(plain);
      times.push(cpuMs(() => checkDeck(fresh)));
    }
    times.sort((a, b) => a - b);
    timings['schema checkDeck'] = times[2] ?? Infinity;
    console.info(
      'schema perf (median ms):',
      Object.fromEntries(
        Object.entries(timings)
          .filter(([k]) => k.startsWith('schema'))
          .map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
    );
    expect(checkDeck(plain).list.filter((p) => p.kind.startsWith('db-'))).toEqual([]);
    expect(timings['schema fromJSON']).toBeLessThan(SCHEMA_LOAD_BUDGET_MS);
    expect(timings['schema toJSON']).toBeLessThan(SCHEMA_LOAD_BUDGET_MS);
    expect(timings['schema column edit']).toBeLessThan(BIG_EDIT_BUDGET_MS);
    expect(timings['schema checkDeck']).toBeLessThan(CHECK_DECK_BUDGET_MS);
  });

  it(`lints a flawed 150-table schema in < ${String(CHECK_DECK_BUDGET_MS)} ms (047 R10)`, () => {
    const flawed = largeSchemaDeck(150, 12, 200);
    for (const [i, table] of flawed.nodes.entries()) {
      const first = table.columns?.[0];
      const second = table.columns?.[1];
      if (first === undefined || second === undefined) continue;
      if (i % 5 === 0) delete first.pk; // no primary key
      if (i % 7 === 0) second.type = 'uuid'; // type mismatch on its relationships
      if (i % 11 === 0) second.type = 'citext'; // unknown type
    }
    const problems = checkDeck(structuredClone(flawed)); // warm-up
    const kinds = new Set(problems.list.map((p) => p.kind));
    expect(kinds).toContain('db-no-primary-key');
    expect(kinds).toContain('db-type-mismatch');
    expect(kinds).toContain('db-unknown-type');
    const times: number[] = [];
    for (let k = 0; k < 5; k++) {
      const fresh = structuredClone(flawed);
      times.push(cpuMs(() => checkDeck(fresh)));
    }
    times.sort((a, b) => a - b);
    timings['schema lint'] = times[2] ?? Infinity;
    expect(timings['schema lint']).toBeLessThan(CHECK_DECK_BUDGET_MS);
  });
});

describe('applying a changed file to the large deck (066 SC-003)', () => {
  const origin = { test: 'perf' };
  /** The large deck with one node title, or every node, edge and step, marked `tag`. */
  function variant(tag: string, everything: boolean): typeof file {
    const copy = structuredClone(file);
    for (const [i, node] of copy.nodes.entries()) {
      if (everything || i === 499) node.title = `${node.title} ${tag}`;
    }
    if (everything) {
      for (const edge of copy.edges) edge.label = `${edge.id} ${tag}`;
      for (const flow of copy.flows) {
        for (const step of flow.steps) step.description = `${step.id} ${tag}`;
      }
    }
    return copy;
  }

  it(`applies one changed title in < ${String(APPLY_ONE_BUDGET_MS)} ms and every changed object in < ${String(APPLY_ALL_BUDGET_MS)} ms`, () => {
    const target = fromJSON(file);
    const one = [variant('a', false), variant('b', false)];
    const all = [variant('a', true), variant('b', true)];
    let i = 0;
    timings['apply one field'] = median(() => {
      applyFile(target, one[i++ % 2] ?? file, origin);
    });
    timings['apply every object'] = median(() => {
      applyFile(target, all[i++ % 2] ?? file, origin);
    });
    timings['apply equal file'] = median(() => {
      applyFile(target, toJSON(target), origin);
    });
    console.info('apply perf (median ms):', {
      one: Number(timings['apply one field'].toFixed(2)),
      all: Number(timings['apply every object'].toFixed(2)),
      equal: Number(timings['apply equal file'].toFixed(2)),
    });
    expect(timings['apply one field']).toBeLessThan(APPLY_ONE_BUDGET_MS);
    expect(timings['apply every object']).toBeLessThan(APPLY_ALL_BUDGET_MS);
  });
});
