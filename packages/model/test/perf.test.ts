import { describe, expect, it } from 'vitest';

import { checkIntegrity, createEditor, fromJSON, observeDeck, serializeDeck, toJSON } from '../src';
import { largeDeck } from './helpers';

// SC-003/004 on 500 nodes / 1,000 edges / 20 flows × 10 steps / 10 rules. Shared CI runners are
// slower and noisier than a laptop, so budgets are multiplied by 3 there. If a budget fails,
// profile first; do not raise the numbers without reporting it.
const SLACK = process.env.CI ? 3 : 1;
const LOAD_BUDGET_MS = 200 * SLACK;
const EDIT_BUDGET_MS = 16 * SLACK;

/** Median of 5 timed runs after 1 warm-up. */
function median(run: () => void): number {
  run();
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[2] ?? Infinity;
}

const file = largeDeck();
const doc = fromJSON(file);
const out = toJSON(doc);
const timings: Record<string, number> = {};

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
    console.info(
      'perf (median ms):',
      Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Number(v.toFixed(2))])),
    );
  });
});
