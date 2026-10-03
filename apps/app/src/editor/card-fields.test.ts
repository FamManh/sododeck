import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  cardFieldView,
  EMPTY_FIELD_VIEW,
  fieldBlock,
  FIELD_BLOCK,
  FIELD_CHIP,
  hiddenLabel,
  hiddenName,
} from './card-fields';
import { fixedWidthMeasurer } from './export/text-measure';

const YEAR = new Date().getFullYear();
const date = (md: string) => `${String(YEAR)}-${md}`;

const fields: SododeckFile['fields'] = [
  {
    id: 'stage',
    name: 'Stage',
    kind: 'status',
    types: ['warehouse'],
    onCard: true,
    options: [{ id: 'live', label: 'Live', color: 'green', icon: 'circle-check' }],
  },
  {
    id: 'region',
    name: 'Region',
    kind: 'select',
    types: ['warehouse'],
    onCard: true,
    options: [{ id: 'south', label: 'South', color: 'amber' }],
  },
  { id: 'note', name: 'Note', kind: 'text', types: ['warehouse'], onCard: true },
  { id: 'runbook', name: 'Runbook', kind: 'link', types: ['warehouse'], onCard: true },
  { id: 'mgr', name: 'Manager', kind: 'person', types: ['warehouse'] },
  { id: 'docks', name: 'Docks', kind: 'number', types: ['warehouse'] },
];
const deck: SododeckFile = { ...emptySododeckFile(), fields, fieldDefaults: [] };

const node = (values: Node['values'], extra: Partial<Node> = {}): Node => ({
  id: 'w',
  type: 'warehouse',
  title: 'HCM',
  ...(values === undefined ? {} : { values }),
  ...extra,
});

describe('cardFieldView (032 R5)', () => {
  it('is empty for a card without values (a deck saved before 032)', () => {
    expect(cardFieldView(emptySododeckFile(), node(undefined, { owner: 'Lan', tech: 'Go' }))).toBe(
      EMPTY_FIELD_VIEW,
    );
  });

  it('splits header status, chips, rows and hidden values, in field order', () => {
    const view = cardFieldView(
      deck,
      node({
        stage: 'live',
        region: 'south',
        note: 'Bay 4 closed',
        runbook: { url: 'https://wiki.example.com/hub' },
        mgr: 'Minh Tran',
        docks: 12,
      }),
    );
    expect(view.header).toEqual({
      fieldId: 'stage',
      kind: 'status',
      name: 'Stage: Live',
      text: 'Live',
      color: 'green',
      icon: 'circle-check',
    });
    expect(view.chips.map((c) => [c.name, c.color])).toEqual([['Region: South', 'amber']]);
    expect(view.rows.map((r) => [r.label, r.text, r.href])).toEqual([
      ['Note', 'Bay 4 closed', undefined],
      ['Runbook', 'wiki.example.com/hub', 'https://wiki.example.com/hub'],
    ]);
    expect(view.hidden).toBe(2);
  });

  it('puts a second status on the shelf, and person / date chips with initials and dates', () => {
    const d: SododeckFile = {
      ...deck,
      fields: [
        ...(deck.fields ?? []),
        {
          id: 'qa',
          name: 'QA',
          kind: 'status',
          types: ['warehouse'],
          onCard: true,
          options: [{ id: 'ok', label: 'OK' }],
        },
        { id: 'who', name: 'Who', kind: 'person', types: ['warehouse'], onCard: true },
        { id: 'due', name: 'Due', kind: 'date', types: ['warehouse'], onCard: true },
        { id: 'span', name: 'Span', kind: 'dateRange', types: ['warehouse'], onCard: true },
      ],
    };
    const view = cardFieldView(
      d,
      node({
        stage: 'live',
        qa: 'ok',
        who: 'Lan',
        due: date('10-14'),
        span: { from: date('10-06'), to: date('10-17') },
      }),
    );
    expect(view.chips.map((c) => c.name)).toEqual([
      'QA: OK',
      'Who: Lan',
      'Due: 14 Oct',
      'Span: 6–17 Oct',
    ]);
    expect(view.chips[0]?.icon).toBe('circle');
    expect(view.chips[1]?.initials).toBe('L');
  });

  it('skips empty and dangling values, and does not count them as hidden', () => {
    const view = cardFieldView(deck, node({ region: 'gone', note: '', ghost: 'x', docks: 'n/a' }));
    expect(view).toBe(EMPTY_FIELD_VIEW);
  });

  it('draws progress clamped, shows rows for numbers with units', () => {
    const d: SododeckFile = { ...emptySododeckFile() };
    const view = cardFieldView(
      d,
      node({ 'warehouse.capacity': 140, 'warehouse.sla': 24, 'warehouse.region': 'x' }),
    );
    expect(view.rows.map((r) => [r.label, r.text, r.progress])).toEqual([
      ['Capacity', '100 %', 100],
      ['SLA', '24 h', undefined],
    ]);
  });

  it('shows Owner as a person chip once turned on, and never counts built-ins as hidden', () => {
    const on: SododeckFile = {
      ...emptySododeckFile(),
      fields: [{ id: 'owner', name: 'Owner', kind: 'person', onCard: true }],
    };
    const svc = { id: 's', type: 'service', title: 'Orders', owner: 'Payments team', tech: 'Go' };
    expect(cardFieldView(on, svc).chips.map((c) => [c.name, c.initials])).toEqual([
      ['Owner: Payments team', 'PT'],
    ]);
    expect(cardFieldView(on, svc).hidden).toBe(0);
  });

  it('is memoised per node and field list', () => {
    const n = node({ region: 'south' });
    expect(cardFieldView(deck, n)).toBe(cardFieldView({ ...deck }, n));
  });
});

describe('fieldBlock (032)', () => {
  const measure = fixedWidthMeasurer(0.55);
  const chip = (text: string) => ({
    fieldId: text,
    kind: 'select' as const,
    name: text,
    text,
  });

  it('is 0 tall without fields', () => {
    expect(fieldBlock(EMPTY_FIELD_VIEW, 184, measure).height).toBe(0);
  });

  it('stacks shelf, 19 px rows and the 20 px pill 8 px apart', () => {
    const view = {
      header: undefined,
      chips: [chip('South')],
      rows: [
        { fieldId: 'a', kind: 'text' as const, label: 'A', text: 'x' },
        { fieldId: 'b', kind: 'text' as const, label: 'B', text: 'y' },
      ],
      hidden: 3,
    };
    const block = fieldBlock(view, 184, measure);
    expect(block).toEqual({
      height: FIELD_CHIP.height + 8 + 2 * FIELD_BLOCK.rowHeight + 8 + FIELD_BLOCK.pillHeight,
      chipRows: 1,
      rowsTop: FIELD_CHIP.height + 8,
      pillTop: FIELD_CHIP.height + 8 + 2 * FIELD_BLOCK.rowHeight + 8,
    });
  });

  it('wraps chips like tags', () => {
    const many = Array.from({ length: 8 }, (_, i) => chip(`Option ${String(i)}`));
    const block = fieldBlock({ header: undefined, chips: many, rows: [], hidden: 0 }, 184, measure);
    expect(block.chipRows).toBeGreaterThan(1);
    expect(block.height).toBe(block.chipRows * 21 + (block.chipRows - 1) * 4);
  });

  it('names the pill', () => {
    expect(hiddenLabel(3)).toBe('+3 fields');
    expect(hiddenLabel(1)).toBe('+1 field');
    expect(hiddenName(3)).toBe('3 more fields');
  });
});
