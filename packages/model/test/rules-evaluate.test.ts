import type { Rule } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { evaluateRule, matchCell, parseCell, ruleChecks, type Cell } from '../src';

describe('parseCell (ADR 0009 grammar)', () => {
  const cases: [string, Cell][] = [
    ['', { kind: 'any' }],
    ['   ', { kind: 'any' }],
    ['Any', { kind: 'any' }],
    ['any', { kind: 'any' }],
    [' ANY ', { kind: 'any' }],
    ['≤ 5', { kind: 'compare', op: '<=', value: 5 }],
    ['<=5', { kind: 'compare', op: '<=', value: 5 }],
    ['< 5', { kind: 'compare', op: '<', value: 5 }],
    ['> 20', { kind: 'compare', op: '>', value: 20 }],
    ['>= -3.5', { kind: 'compare', op: '>=', value: -3.5 }],
    ['≥0.5', { kind: 'compare', op: '>=', value: 0.5 }],
    ['≤', { kind: 'invalid' }],
    ['>', { kind: 'invalid' }],
    ['> abc', { kind: 'invalid' }],
    ['< 5x', { kind: 'invalid' }],
    ['Bike, Van', { kind: 'list', values: ['Bike', 'Van'] }],
    ['1,000', { kind: 'list', values: ['1', '000'] }],
    ['a,,b', { kind: 'invalid' }],
    ['a, > 5', { kind: 'invalid' }],
    ['a,', { kind: 'invalid' }],
    ['Express', { kind: 'exact', value: 'Express' }],
    ['  45 min ', { kind: 'exact', value: '45 min' }],
  ];
  it.each(cases)('parses %j', (text, cell) => {
    expect(parseCell(text)).toEqual(cell);
  });
});

describe('matchCell', () => {
  const m = (cell: string, input: string) => matchCell(parseCell(cell), input);

  it('matches Any against everything, including an empty input', () => {
    expect(m('Any', 'x')).toBe(true);
    expect(m('', '')).toBe(true);
    expect(m('any', '  ')).toBe(true);
  });

  it('compares numbers only', () => {
    expect(m('≤ 5', '5')).toBe(true);
    expect(m('≤ 5', '5.1')).toBe(false);
    expect(m('< 5', '5')).toBe(false);
    expect(m('> 20', '21')).toBe(true);
    expect(m('>= -3.5', '-3.5')).toBe(true);
    expect(m('≤ 5', ' 3 ')).toBe(true);
    expect(m('≤ 5', 'far')).toBe(false);
    expect(m('≤ 5', '')).toBe(false);
  });

  it('matches exact values numerically or case-folded', () => {
    expect(m('5', '5.0')).toBe(true);
    expect(m('5.0', '5')).toBe(true);
    expect(m('Express', 'express')).toBe(true);
    expect(m('Express', ' EXPRESS ')).toBe(true);
    expect(m('Express', 'Standard')).toBe(false);
    expect(m('Express', '')).toBe(false);
  });

  it('matches a list when any item matches', () => {
    expect(m('Bike, Van', 'van')).toBe(true);
    expect(m('Bike, Van', 'Truck')).toBe(false);
    expect(m('1, 2', '2.0')).toBe(true);
    expect(m('Bike, Van', '')).toBe(false);
  });

  it('never matches an invalid cell', () => {
    expect(m('> abc', 'abc')).toBe(false);
    expect(m('≤', '')).toBe(false);
    expect(m('a,,b', 'a')).toBe(false);
  });
});

/** The spec's Delivery tier table (story 4, design 04). */
function deliveryTier(hitPolicy: Rule['hitPolicy']): Rule {
  return {
    title: 'Delivery tier',
    hitPolicy,
    inputs: [
      { id: 'dist', label: 'Distance (km)' },
      { id: 'weight', label: 'Weight (kg)' },
      { id: 'prio', label: 'Priority' },
    ],
    outputs: [
      { id: 'vehicle', label: 'Vehicle' },
      { id: 'sla', label: 'SLA' },
      { id: 'fee', label: 'Surcharge' },
    ],
    rows: [
      { id: 'row1', when: ['≤ 5', '≤ 10', 'Express'], then: ['Bike', '45 min', '€4.00'] },
      { id: 'row2', when: ['≤ 5', '≤ 10', 'Standard'], then: ['Bike', '90 min', '€0.00'] },
      { id: 'row3', when: ['≤ 20', 'Any', 'Express, Standard'], then: ['Van', '2 h', '€2.00'] },
      { id: 'row4', when: ['> 20', '> 10', 'Any'], then: ['Truck', 'Next day', '€8.00'] },
      { id: 'row5', when: ['> 20', 'Any', 'Any'], then: ['Van', 'Next day', '€5.00'] },
    ],
  };
}

const inputs = (dist: string, weight: string, prio: string) => ({ dist, weight, prio });

describe('evaluateRule', () => {
  it('First match returns the first matching row', () => {
    const rule = deliveryTier('first');
    expect(evaluateRule(rule, inputs('5', '10', 'Express'))).toEqual({
      status: 'match',
      rows: ['row1'],
    });
    expect(evaluateRule(rule, inputs('5', '10', 'Standard'))).toEqual({
      status: 'match',
      rows: ['row2'],
    });
    expect(evaluateRule(rule, inputs('30', '5', 'Standard'))).toEqual({
      status: 'match',
      rows: ['row5'],
    });
  });

  it('gives no match when an input is empty against non-Any cells', () => {
    expect(evaluateRule(deliveryTier('first'), inputs('5', '', 'Express'))).toEqual({
      status: 'match',
      rows: ['row3'],
    });
    expect(evaluateRule(deliveryTier('first'), inputs('', '', ''))).toEqual({ status: 'none' });
  });

  it('treats a missing input key as empty', () => {
    expect(evaluateRule(deliveryTier('first'), { dist: '5' })).toEqual({ status: 'none' });
  });

  it('Unique with several matches is ambiguous and has no winner', () => {
    const rule = deliveryTier('unique');
    expect(evaluateRule(rule, inputs('5', '10', 'Express'))).toEqual({
      status: 'ambiguous',
      rows: ['row1', 'row3'],
    });
    expect(evaluateRule(rule, inputs('15', '10', 'Express'))).toEqual({
      status: 'match',
      rows: ['row3'],
    });
  });

  it('Collect returns every matching row in order', () => {
    const rule = deliveryTier('collect');
    expect(evaluateRule(rule, inputs('5', '10', 'Express'))).toEqual({
      status: 'match',
      rows: ['row1', 'row3'],
    });
    expect(evaluateRule(rule, inputs('30', '20', 'x'))).toEqual({
      status: 'match',
      rows: ['row4', 'row5'],
    });
    expect(evaluateRule(rule, inputs('far', '1', 'x'))).toEqual({ status: 'none' });
  });

  it('handles rules with no columns or no rows', () => {
    const empty: Rule = { title: 'E', hitPolicy: 'first', inputs: [], outputs: [], rows: [] };
    expect(evaluateRule(empty, {})).toEqual({ status: 'none' });
    const noConditions: Rule = {
      ...empty,
      outputs: [{ id: 'o', label: 'Out' }],
      rows: [
        { id: 'a', when: [], then: ['1'] },
        { id: 'b', when: [], then: ['2'] },
      ],
    };
    expect(evaluateRule(noConditions, {})).toEqual({ status: 'match', rows: ['a'] });
    expect(evaluateRule({ ...noConditions, hitPolicy: 'collect' }, {})).toEqual({
      status: 'match',
      rows: ['a', 'b'],
    });
  });

  it('evaluates a 50-row, 5-condition rule in under 100 ms (SC-003)', () => {
    const rule: Rule = {
      title: 'Big',
      hitPolicy: 'collect',
      inputs: Array.from({ length: 5 }, (_, i) => ({
        id: `c${String(i)}`,
        label: `C${String(i)}`,
      })),
      outputs: [{ id: 'o', label: 'Out' }],
      rows: Array.from({ length: 50 }, (_, r) => ({
        id: `r${String(r)}`,
        when: [`> ${String(r)}`, 'Any', 'a, b, c', `≤ ${String(r * 2)}`, 'x'],
        then: [String(r)],
      })),
    };
    const values = { c0: '25', c1: 'q', c2: 'B', c3: '40', c4: 'X' };
    const start = performance.now();
    for (let i = 0; i < 100; i++) evaluateRule(rule, values);
    expect((performance.now() - start) / 100).toBeLessThan(100);
    expect(evaluateRule(rule, values)).toEqual({
      status: 'match',
      rows: Array.from({ length: 5 }, (_, i) => `r${String(20 + i)}`),
    });
  });
});

describe('ruleChecks', () => {
  it('finds no catch-all in the Delivery tier table and lists invalid cells', () => {
    const rule = deliveryTier('first');
    expect(ruleChecks(rule)).toEqual({ catchAll: false, invalidCells: [] });
    const withInvalid: Rule = {
      ...rule,
      rows: [...rule.rows, { id: 'bad', when: ['> abc', 'Any', 'a,,b'], then: ['', '', ''] }],
    };
    expect(ruleChecks(withInvalid).invalidCells).toEqual([
      { rowId: 'bad', columnId: 'dist' },
      { rowId: 'bad', columnId: 'prio' },
    ]);
  });

  it('detects a catch-all row (all Any or empty)', () => {
    const rule = deliveryTier('first');
    const withCatchAll: Rule = {
      ...rule,
      rows: [...rule.rows, { id: 'all', when: ['Any', '', 'any'], then: ['Van', '', ''] }],
    };
    expect(ruleChecks(withCatchAll).catchAll).toBe(true);
  });

  it('has no catch-all without rows, and every row is one without conditions', () => {
    const empty: Rule = { title: 'E', hitPolicy: 'first', inputs: [], outputs: [], rows: [] };
    expect(ruleChecks(empty)).toEqual({ catchAll: false, invalidCells: [] });
    expect(ruleChecks({ ...empty, rows: [{ id: 'r', when: [], then: [] }] }).catchAll).toBe(true);
  });
});
