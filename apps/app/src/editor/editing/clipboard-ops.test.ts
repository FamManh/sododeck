import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_SELECTION, useUiStore } from '../../state/ui-store';
import { deckOf } from '../../test/render-canvas';
import { copySelectionText, duplicateSelection, pasteText } from './clipboard-ops';

const table = (id: string, x: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'db-table',
  title: id,
  position: { x, y: 0 },
  columns: [
    { id: `${id}.id`, name: 'id', type: 'int', pk: true },
    { id: `${id}.ref`, name: 'ref', type: 'int' },
  ],
  ...extra,
});

const rel = (id: string, from: string, to: string) => ({
  id,
  from,
  to,
  fromColumns: [`${from}.ref`],
  toColumns: [`${to}.id`],
  cardinality: 'n-1' as const,
});

/** orders → customers, orders → addresses, reviews → orders. */
const shop = deckOf({
  nodes: [
    table('orders', 0),
    table('customers', 400),
    table('addresses', 800),
    table('reviews', 1200),
  ],
  edges: [
    rel('r1', 'orders', 'customers'),
    { ...rel('r2', 'orders', 'addresses'), fromColumns: ['orders.id'] },
    rel('r3', 'reviews', 'orders'),
  ],
});

const ui = () => useUiStore.getState();

function setup(file: SododeckFile = shop) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc) };
}

beforeEach(() => {
  ui().resetForDeck();
});

describe('duplicate and paste of tables (043 US5, R10)', () => {
  it('duplicates a table with its outgoing relationships only, then opens its title', () => {
    const { doc, editor } = setup();
    expect(duplicateSelection(editor, { ...EMPTY_SELECTION, nodes: ['orders'] })).toBe(true);
    const deck = toJSON(doc);
    const copy = deck.nodes.find((n) => n.title === 'orders_copy');
    expect(copy).toBeDefined();
    if (copy === undefined) return;
    const fromCopy = deck.edges.filter((e) => e.from === copy.id);
    expect(fromCopy.map((e) => e.to).sort()).toEqual(['addresses', 'customers']);
    expect(deck.edges.filter((e) => e.to === copy.id)).toEqual([]);
    expect(ui().selection.nodes).toEqual([copy.id]);
    expect(ui().titleEdit).toEqual({ target: 'node', id: copy.id, isNew: false });
    editor.undo();
    expect(toJSON(doc).nodes).toHaveLength(4);
    expect(toJSON(doc).edges).toHaveLength(3);
  });

  it('drops relationships to tables the target deck lacks, with an Undo toast', () => {
    const source = setup();
    const copy = copySelectionText(source.editor, { ...EMPTY_SELECTION, nodes: ['orders'] });
    expect(copy).not.toBeNull();
    if (copy === null) return;
    const target = setup(deckOf({ nodes: [table('customers', 0)] }));
    const undoToast = vi.fn();
    expect(pasteText(target.editor, copy.text, { x: 500, y: 500 }, null, undoToast)).toBe(true);
    expect(undoToast).toHaveBeenCalledWith('Pasted orders · 1 relationship dropped');
    const deck = toJSON(target.doc);
    const pasted = deck.nodes.find((n) => n.title === 'orders');
    expect(pasted?.columns?.map((c) => c.name)).toEqual(['id', 'ref']);
    expect(deck.edges).toHaveLength(1);
    expect(deck.edges[0]?.to).toBe('customers');
    expect(ui().titleEdit?.id).toBe(pasted?.id);
    target.editor.undo();
    expect(toJSON(target.doc).nodes.map((n) => n.id)).toEqual(['customers']);
    expect(toJSON(target.doc).edges).toEqual([]);
  });

  it('announces a plain paste with nothing dropped', () => {
    const source = setup();
    const copy = copySelectionText(source.editor, {
      ...EMPTY_SELECTION,
      nodes: ['orders', 'customers', 'addresses'],
    });
    if (copy === null) throw new Error('nothing copied');
    const target = setup(deckOf({}));
    const undoToast = vi.fn();
    pasteText(target.editor, copy.text, { x: 0, y: 0 }, null, undoToast);
    expect(undoToast).not.toHaveBeenCalled();
    expect(ui().announcement.text).toBe('Pasted 3 components and 2 connections');
    expect(ui().titleEdit).toBeNull();
  });
});
