import { describe, expect, it } from 'vitest';

import { fromJSON, serializeDeck, toJSON } from '../src';
import { largeDeck } from './helpers';

// 004 research R2: the JSON panel serializes the whole deck on the main thread (throttled to
// 250 ms). The budget is one frame. If this fails, move serialization to a worker (TODO(perf)).
const SLACK = process.env.CI ? 3 : 1;
const SERIALIZE_BUDGET_MS = 16 * SLACK;

/** A 500 / 1,000 deck with long descriptions, tags and links: richer than the bench deck. */
function richDeck() {
  const file = largeDeck({ nodes: 500, edges: 1000, flows: 20, stepsPerFlow: 10, rules: 10 });
  const description = 'Handles **things** for the platform. '.repeat(6).slice(0, 200);
  for (const [i, node] of file.nodes.entries()) {
    node.description = description;
    node.tech = 'Go 1.24 · gRPC';
    node.tags = ['core', 'payments', `team-${String(i % 7)}`];
    node.links = [
      { label: 'Repo', url: `https://example.com/repo/${node.id}` },
      { label: 'Runbook', url: `https://example.com/runbook/${node.id}` },
    ];
  }
  return file;
}

describe('serializeDeck performance (004 research R2)', () => {
  it(`stays under ${String(SERIALIZE_BUDGET_MS)} ms on a rich 500 / 1,000 deck`, () => {
    const snapshot = toJSON(fromJSON(richDeck()));
    expect(snapshot.nodes).toHaveLength(500);
    expect(snapshot.edges).toHaveLength(1000);

    for (let i = 0; i < 3; i++) serializeDeck(snapshot); // warm-up
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      serializeDeck(snapshot);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const median = times[5] ?? Infinity;
    expect(median).toBeLessThan(SERIALIZE_BUDGET_MS);
  });
});
