import { describe, expect, it } from 'vitest';

import { importMermaid } from '../storage/library-ops';

describe('a 500-node flowchart', () => {
  it('is parsed and built in the worker op well under a second, with 500 components', () => {
    const lines = ['flowchart TD'];
    for (let i = 0; i < 500; i++) lines.push(`N${i}[Component ${i}]`);
    for (let i = 0; i < 600; i++) lines.push(`N${i % 500} -->|link ${i}| N${(i * 7 + 1) % 500}`);
    const text = lines.join('\n');
    const started = performance.now();
    const { file, report } = importMermaid(text);
    const elapsed = performance.now() - started;
    console.info(`500-node flowchart: parse + build ${elapsed.toFixed(1)} ms`);
    expect(file.nodes).toHaveLength(500);
    expect(report.counts).toMatchObject({ components: 500, connections: 600 });
    expect(elapsed).toBeLessThan(1000);
  });
});
