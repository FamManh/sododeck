// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { computeLayout } from './elk-layout';

describe('computeLayout', () => {
  it('lays out a chain left to right', async () => {
    const size = { width: 164, height: 50 };
    const result = await computeLayout({
      nodes: [
        { id: 'a', ...size },
        { id: 'b', ...size },
        { id: 'c', ...size },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    });
    expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c']);
    expect(result.a?.x).toBeLessThan(result.b?.x ?? 0);
    expect(result.b?.x).toBeLessThan(result.c?.x ?? 0);
  });
});
