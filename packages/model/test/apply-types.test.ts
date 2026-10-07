import { describe, expect, it } from 'vitest';

import { SummaryBuilder } from '../src/apply-types';

describe('SummaryBuilder (066 R9)', () => {
  it('is empty when nothing was counted', () => {
    expect(new SummaryBuilder().build()).toEqual({});
  });

  it('counts per scope and lists only scopes that were counted', () => {
    const summary = new SummaryBuilder();
    summary.added('edges');
    summary.removed('stickies');
    summary.changed('nodes');
    summary.changed('nodes');
    summary.changed('meta');
    expect(summary.build()).toEqual({
      edges: { added: 1, changed: 0, removed: 0 },
      stickies: { added: 0, changed: 0, removed: 1 },
      nodes: { added: 0, changed: 2, removed: 0 },
      meta: { added: 0, changed: 1, removed: 0 },
    });
  });

  it('returns a copy, so a later count does not change a built summary', () => {
    const summary = new SummaryBuilder();
    summary.added('nodes');
    const built = summary.build();
    summary.added('nodes');
    expect(built.nodes?.added).toBe(1);
  });
});
