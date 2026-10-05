import { describe, expect, it } from 'vitest';

import { lintText } from '../src/lint';
import { summarizeDeck } from '../src/summary';
import { summaryText } from '../src/text';
import { exampleText } from './fixtures';

function summary(name: string) {
  const { file, report } = lintText(exampleText(name), name, 'test');
  if (file === undefined) throw new Error('example must load');
  return {
    summary: summarizeDeck(file, report),
    titles: new Map(file.nodes.map((n) => [n.id, n.title])),
  };
}

describe('deck summary (027 FR-017)', () => {
  it('lists groups, levels, flows with numbered steps and totals', () => {
    const { summary: s } = summary('platform.sododeck');
    expect(s.totals).toMatchObject({ cards: 9, groups: 3, connectors: 8, flows: 1, rules: 0 });
    expect(s.levels).toEqual([
      { parent: null, cards: 4 },
      { parent: 'platform', cards: 5 },
    ]);
    expect(s.groups.find((g) => g.id === 'data')?.cards).toEqual(['jobs', 'deliveries-db']);
    expect(s.flows[0]?.steps.map((step) => `${step.number}. ${step.from} → ${step.to}`)).toEqual([
      '1. api → dispatch',
      '2. dispatch → jobs',
      '3. jobs → tracking',
      '4. tracking → deliveries-db',
    ]);
  });

  it('shows which steps and cards use a rule', () => {
    const { summary: s } = summary('refund-policy.sododeck');
    expect(s.rules).toEqual([
      { id: 'refund-approval', title: 'Refund approval', usedBy: ['refund/request'] },
    ]);
    expect(s.flows[0]?.steps[0]?.rules).toEqual(['refund-approval']);
  });

  it('fits a readable outline on one screen', () => {
    const { summary: s, titles } = summary('platform.sododeck');
    const outline = summaryText(s, titles);
    expect(outline).toContain('Deck: Delivery platform');
    expect(outline).toContain('Levels: top 4 · under platform 5');
    expect(outline).toContain('Flow "Assign a courier" [assign-courier]:');
    expect(outline).not.toContain('Problems:');
    expect(outline.split('\n').length).toBeLessThan(40);
  });

  it('points to lint when the deck has problems', () => {
    const { summary: s, titles } = summary('checkout.sododeck');
    const outline = summaryText({ ...s, problems: { error: 1, warning: 2 } }, titles);
    expect(outline).toContain('Problems: 1 error, 2 warnings; run lint for details.');
  });
});
