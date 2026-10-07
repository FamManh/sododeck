import { createEditor, fromJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../bench/generate-deck';
import { attachHostPersistence } from './host-persistence';

// SC-002: a change reaches the host within 200 ms of the edit (100 ms window + serialising).
const BUDGET_MS = process.env.CI ? 350 : 200;

describe('host persistence performance (067 SC-002)', () => {
  it(`delivers an edit of the 500-node bench deck in under ${String(BUDGET_MS)} ms`, async () => {
    const doc = fromJSON(generateBenchDeck(500, 1000).deck);
    const editor = createEditor(doc);
    const delivered: number[] = [];
    const persistence = attachHostPersistence(
      doc,
      () => {
        delivered.push(performance.now());
      },
      { onError: () => undefined },
    );

    // Warm-up (JIT, first serialisation), then the measured edit.
    editor.update('nodes', 'n0', { position: { x: 1, y: 1 } });
    await persistence.flush();
    delivered.length = 0;

    const start = performance.now();
    editor.update('nodes', 'n1', { position: { x: 5, y: 5 } });
    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (delivered.length > 0) {
          clearInterval(poll);
          resolve();
        }
      }, 5);
    });
    const elapsed = (delivered[0] ?? Infinity) - start;
    persistence.destroy();
    console.info(`host change delivered ${elapsed.toFixed(0)} ms after the edit`);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
