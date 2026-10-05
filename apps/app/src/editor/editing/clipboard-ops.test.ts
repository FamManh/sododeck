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

describe('copy, duplicate and paste of images (055)', () => {
  const asset = 'a'.repeat(64);
  const picture = (id: string, x: number, extra: Record<string, unknown> = {}) => ({
    id,
    asset,
    position: { x, y: 100 },
    size: { width: 80, height: 60 },
    ...extra,
  });
  const gallery = deckOf({
    nodes: [{ id: 'card', type: 'service', title: 'Card', position: { x: 0, y: 0 }, group: 'g' }],
    groups: [{ id: 'g', title: 'Group' }],
    images: [picture('i1', 200, { group: 'g', alt: 'Logo' }), picture('i2', 400)],
    assets: {
      [asset]: { type: 'image/png', bytes: 1, width: 1, height: 1, name: 'a.png', data: '' },
    },
  });
  const selection = { ...EMPTY_SELECTION, nodes: ['card'], images: ['i1', 'i2'] };

  it('duplicates images with a card: new ids, same picture, kept group, on top, selected', () => {
    const { doc, editor } = setup(gallery);
    // The card and the first image share group g, so the copies go into it (016 R11).
    const inGroup = { ...EMPTY_SELECTION, nodes: ['card'], images: ['i1'] };
    expect(duplicateSelection(editor, inGroup)).toBe(true);
    const deck = toJSON(doc);
    expect(deck.images).toHaveLength(3);
    const copy = (deck.images ?? []).find((i) => i.id !== 'i1' && i.id !== 'i2');
    expect(copy).toMatchObject({ asset, alt: 'Logo', group: 'g', position: { x: 224, y: 124 } });
    expect(ui().selection.images).toEqual([copy?.id]);
    expect(ui().announcement.text).toBe('Duplicated 1 component');
    editor.undo();
    expect(toJSON(doc).images).toHaveLength(2);
  });

  it('duplicates images that share no group at the top level', () => {
    const { doc, editor } = setup(gallery);
    expect(duplicateSelection(editor, selection)).toBe(true);
    const copies = (toJSON(doc).images ?? []).filter((i) => i.id !== 'i1' && i.id !== 'i2');
    expect(copies.map((i) => i.asset)).toEqual([asset, asset]);
    expect(copies.every((i) => i.group === undefined)).toBe(true);
    expect(copies.map((i) => i.position).sort((a, b) => a.x - b.x)).toEqual([
      { x: 224, y: 124 },
      { x: 424, y: 124 },
    ]);
  });

  it('copies an image alone and pastes it at the pointer, announcing "1 image"', () => {
    const { doc, editor } = setup(gallery);
    const copy = copySelectionText(editor, { ...EMPTY_SELECTION, images: ['i2'] });
    expect(copy).not.toBeNull();
    if (copy === null) return;
    expect(pasteText(editor, copy.text, { x: 1000, y: 1000 }, null)).toBe(true);
    const deck = toJSON(doc);
    expect(deck.images).toHaveLength(3);
    const pasted = deck.images?.find((i) => !['i1', 'i2'].includes(i.id));
    expect(pasted).toMatchObject({ asset, position: { x: 1000, y: 1000 } });
    expect(ui().announcement.text).toBe('Pasted 1 image');
    expect(ui().selection.images).toEqual([pasted?.id]);
  });

  it('leaves the original where it was and stacks the pasted copy on top', () => {
    const { doc, editor } = setup(gallery);
    const copy = copySelectionText(editor, { ...EMPTY_SELECTION, images: ['i1'] });
    if (copy === null) throw new Error('nothing copied');
    pasteText(editor, copy.text, { x: 5000, y: 5000 }, null);
    const deck = toJSON(doc);
    expect(deck.images).toHaveLength(3);
    expect(deck.images?.find((i) => i.id === 'i1')?.position).toEqual({ x: 200, y: 100 });
    const pasted = deck.images?.find((i) => !['i1', 'i2'].includes(i.id));
    const ranks = (deck.images ?? []).map((i) => i.z ?? 0);
    expect(pasted?.z).toBe(Math.max(...ranks));
  });
});
