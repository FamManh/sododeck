import { emptySododeckFile, type SododeckFile, type Step } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  cardChip,
  mergedChip,
  playerNotes,
  playerNoteText,
  touchSets,
  touchedColumns,
  touchedTables,
} from './touches';

const table = (id: string, parent?: string) => ({
  id,
  type: 'db-table' as const,
  title: id,
  columns: [{ id: `${id}-id`, name: 'id', type: 'int' }],
  ...(parent === undefined ? {} : { parent }),
});

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'odb', type: 'database', title: 'Orders DB' },
    { id: 'cdb', type: 'database', title: 'Customers DB' },
    table('orders', 'odb'),
    table('order_items', 'odb'),
    table('customers', 'cdb'),
    table('invoices'),
  ],
};

const step: Step = {
  id: 's',
  edge: 'e',
  touches: [
    { table: 'orders', column: 'orders-id', access: 'read' },
    { table: 'orders', access: 'write' },
    { table: 'order_items', access: 'write' },
    { table: 'customers', column: 'customers-id', access: 'read' },
  ],
};

describe('touched sets (049)', () => {
  it('lists tables in first-touch order, write beating read, and columns with access', () => {
    expect([...touchedTables(step)]).toEqual([
      ['orders', 'write'],
      ['order_items', 'write'],
      ['customers', 'read'],
    ]);
    expect([...touchedColumns(step)]).toEqual([
      ['orders-id', 'read'],
      ['customers-id', 'read'],
    ]);
  });

  it('is empty for a step without touches', () => {
    expect(touchedTables({ touches: [] }).size).toBe(0);
    expect(touchedTables(undefined).size).toBe(0);
    expect(touchedColumns(null).size).toBe(0);
  });

  it('returns the same object for the same step (cache)', () => {
    expect(touchSets(step)).toBe(touchSets(step));
    expect(touchSets({ ...step })).not.toBe(touchSets(step));
  });
});

describe('card chips (049)', () => {
  it('names the first touched table of the card with its verb and counts the rest', () => {
    expect(cardChip(deck, 'odb', step)).toEqual({ text: 'writes orders +1', access: 'write' });
    expect(cardChip(deck, 'cdb', step)).toEqual({ text: 'reads customers', access: 'read' });
  });

  it('is null for a card the step does not touch, or a step with no touches', () => {
    expect(cardChip(deck, 'odb', { touches: [{ table: 'invoices', access: 'read' }] })).toBeNull();
    expect(cardChip(deck, 'odb', { id: 'x', edge: 'e' } as Step)).toBeNull();
  });

  it('merges the chips of several cards (a collapsed group)', () => {
    expect(mergedChip(deck, new Set(['odb', 'cdb']), step)?.text).toBe('writes orders +2');
  });
});

describe('player notes (049)', () => {
  const all = new Set(deck.nodes.map((n) => n.id));

  it('names nothing at architecture level when every card is drawn, except unowned tables', () => {
    const notes = playerNotes(
      deck,
      { touches: [...(step.touches ?? []), { table: 'invoices', access: 'read' }] },
      { drawn: new Set(['odb', 'cdb']), inView: all },
    );
    expect(notes).toEqual([{ label: 'invoices', hidden: false }]);
  });

  it('names tables of another card while drilled in, and lights the ones drawn', () => {
    const notes = playerNotes(deck, step, {
      drawn: new Set(['orders', 'order_items']),
      inView: all,
    });
    expect(notes).toEqual([{ label: 'Customers DB · customers', hidden: false }]);
    expect(playerNoteText(notes)).toBe('Also touches: Customers DB · customers');
  });

  it('flags tables the view hides, without changing the view', () => {
    const inView = new Set([...all].filter((id) => id !== 'order_items'));
    const notes = playerNotes(deck, step, { drawn: new Set(['orders', 'cdb']), inView });
    expect(notes).toEqual([{ label: 'Orders DB · order_items', hidden: true }]);
    expect(playerNoteText(notes)).toBe(
      'Also touches: Orders DB · order_items (hidden in this view)',
    );
  });

  it('has no text when there is nothing to name', () => {
    expect(playerNoteText([])).toBeNull();
  });
});
