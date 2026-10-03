import { emptySododeckFile, type FieldDef, type FieldKind } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { clearedByKindChange, convertValue, planKindChange, validateValue } from '../src';

const field = (kind: FieldKind, extra: Partial<FieldDef> = {}): FieldDef => ({
  id: 'f',
  name: 'F',
  kind,
  ...extra,
});
const sel = field('select', {
  options: [
    { id: 'o1', label: 'North' },
    { id: 'o2', label: 'South', color: 'amber' },
  ],
});

describe('validateValue (032 FR-002, FR-015)', () => {
  it.each([
    ['text', 'hello'],
    ['person', 'Lan'],
    ['number', -3.5],
    ['number', 0],
    ['progress', 0],
    ['progress', 100],
    ['date', '2026-10-14'],
    ['dateRange', { from: '2026-10-06', to: '2026-10-17' }],
    ['dateRange', { from: '2026-10-06', to: '2026-10-06' }],
    ['link', { url: 'https://example.com/a?b=1' }],
    ['link', { url: 'http://x.io', label: 'X' }],
    ['link', { url: 'mailto:a@example.com' }],
  ] as const)('accepts a %s value %j', (kind, value) => {
    expect(validateValue(field(kind), value)).toBeNull();
  });

  it('accepts option ids of select and status fields', () => {
    expect(validateValue(sel, 'o2')).toBeNull();
    expect(validateValue({ ...sel, kind: 'status' }, 'o1')).toBeNull();
  });

  it.each([
    ['text', '   ', 'Enter some text.'],
    ['text', 3, 'Enter some text.'],
    ['person', '', 'Enter a name.'],
    ['number', '5', 'Enter a number.'],
    ['number', Number.NaN, 'Enter a number.'],
    ['progress', 140, 'Enter a number from 0 to 100.'],
    ['progress', -1, 'Enter a number from 0 to 100.'],
    ['date', '14/10', 'Enter a date as YYYY-MM-DD.'],
    ['date', '2026-02-30', 'Enter a date as YYYY-MM-DD.'],
    ['dateRange', { from: '2026-10-17', to: '2026-10-06' }, 'The end is before the start.'],
    ['dateRange', { from: '2026-10-17' }, 'Enter a start and an end date.'],
    ['link', { url: 'ftp:x' }, 'Enter a web (http, https) or mail (mailto) address.'],
    ['link', { url: 'example.com' }, 'Enter a web (http, https) or mail (mailto) address.'],
    ['link', 'https://x.io', 'Enter a web (http, https) or mail (mailto) address.'],
  ] as const)('refuses a %s value %j', (kind, value, message) => {
    expect(validateValue(field(kind), value)).toBe(message);
  });

  it('refuses an option id the field does not have', () => {
    expect(validateValue(sel, 'gone')).toBe('Pick one of the options.');
  });
});

describe('convertValue (032 clarify Q2 table)', () => {
  const status = field('status', { options: sel.options });
  it.each([
    // [from, to kind, value, expected]
    [field('text'), 'person', 'Lan', 'Lan'],
    [field('person'), 'text', 'Lan', 'Lan'],
    [sel, 'status', 'o2', 'o2'],
    [status, 'select', 'o1', 'o1'],
    [field('number'), 'progress', 42, 42],
    [field('number'), 'progress', 140, null],
    [field('progress'), 'number', 42, 42],
    [field('number'), 'text', 5, '5'],
    [field('date'), 'text', '2026-10-14', '2026-10-14'],
    [sel, 'text', 'o2', 'South'],
    [status, 'text', 'o1', 'North'],
    [field('link'), 'text', { url: 'https://x.io', label: 'X' }, 'https://x.io'],
    [field('text'), 'number', ' 8 ', 8],
    [field('text'), 'number', 'big', null],
    [field('text'), 'number', '', null],
    [field('date'), 'dateRange', '2026-10-14', { from: '2026-10-14', to: '2026-10-14' }],
    [field('dateRange'), 'date', { from: '2026-10-06', to: '2026-10-17' }, '2026-10-06'],
  ] as const)('%j → %s keeps or clears %j', (from, kind, value, expected) => {
    expect(convertValue(from, { kind }, value)).toEqual(expected);
  });

  it('turns text into the option with the same label', () => {
    const options = [
      { id: 'a', label: 'North' },
      { id: 'b', label: 'South' },
    ];
    expect(convertValue(field('text'), { kind: 'select', options }, ' South ')).toBe('b');
    expect(convertValue(field('text'), { kind: 'status', options }, 'West')).toBeNull();
  });

  it.each([
    ['person', 'number'],
    ['dateRange', 'text'],
    ['link', 'number'],
    ['progress', 'date'],
    ['select', 'person'],
    ['date', 'number'],
  ] as const)('clears %s → %s', (from, to) => {
    const values = {
      person: 'Lan',
      dateRange: { from: '2026-10-06', to: '2026-10-17' },
      link: { url: 'https://x.io' },
      progress: 5,
      select: 'o1',
      date: '2026-10-06',
    };
    expect(
      convertValue(field(from, from === 'select' ? sel : {}), { kind: to }, values[from]),
    ).toBe(null);
  });
});

describe('planKindChange / clearedByKindChange', () => {
  const deck = {
    ...emptySododeckFile(),
    fields: [{ id: 'est', name: 'Estimate', kind: 'text', types: ['task'] }],
    nodes: [
      { id: 'a', type: 'task', title: 'A', values: { est: '5' } },
      { id: 'b', type: 'task', title: 'B', values: { est: '8' } },
      { id: 'c', type: 'task', title: 'C', values: { est: 'big' } },
      { id: 'd', type: 'task', title: 'D' },
    ],
  } satisfies ReturnType<typeof emptySododeckFile>;

  it('counts the values a kind change would clear', () => {
    expect(clearedByKindChange(deck, 'est', 'number')).toBe(1);
    expect(clearedByKindChange(deck, 'est', 'person')).toBe(0);
    expect(clearedByKindChange(deck, 'est', 'date')).toBe(3);
  });

  it('makes one option per distinct text, in first-seen order, for text → select', () => {
    const plan = planKindChange(deck, 'est', 'select', (i) => `o${String(i)}`);
    expect(plan.options).toEqual([
      { id: 'o0', label: '5' },
      { id: 'o1', label: '8' },
      { id: 'o2', label: 'big' },
    ]);
    expect(plan.values).toEqual(
      new Map([
        ['a', 'o0'],
        ['b', 'o1'],
        ['c', 'o2'],
      ]),
    );
    expect(plan.cleared).toBe(0);
  });

  it('drops status icons going to select, and keeps them going to status', () => {
    const d = {
      ...emptySododeckFile(),
      fields: [
        {
          id: 's',
          name: 'S',
          kind: 'status',
          options: [{ id: 'x', label: 'X', color: 'blue', icon: 'eye' }],
        },
      ],
    } satisfies ReturnType<typeof emptySododeckFile>;
    expect(planKindChange(d, 's', 'select').options).toEqual([
      { id: 'x', label: 'X', color: 'blue' },
    ]);
    expect(planKindChange(d, 's', 'text').options).toBeUndefined();
  });
});
