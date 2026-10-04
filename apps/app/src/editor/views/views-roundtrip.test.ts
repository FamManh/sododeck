import { serializeDeck } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { exportDeck, importFile } from '../../storage/library-ops';
import { deckOf } from '../../test/render-canvas';
import { tableLayoutOf } from '../canvas-geometry';
import { viewStateOf } from './view-state';

/** SC-007: a deck with schema, table and detail filters and a collapsed schema survives a file. */
const file: SododeckFile = {
  ...deckOf({
    name: 'Shop',
    groupingMode: 'schema',
    nodes: [
      {
        id: 'p',
        type: 'db-table',
        title: 'payments',
        schema: 'billing',
        position: { x: 10, y: 20 },
        columns: [
          { id: 'a', name: 'id', type: 'int', pk: true },
          { id: 'b', name: 'amount', type: 'int' },
        ],
      },
      {
        id: 'i',
        type: 'db-table',
        title: 'invoices',
        schema: 'billing',
        position: { x: 300, y: 0 },
      },
      { id: 'c', type: 'db-table', title: 'customers', schema: 'crm', position: { x: 0, y: 300 } },
    ],
    edges: [{ id: 'pc', from: 'p', to: 'c' }],
    views: [
      { id: 'base', type: 'system', title: 'All' },
      {
        id: 'bill',
        type: 'custom',
        title: 'Billing',
        schemas: ['billing'],
        includes: ['c'],
        detail: 'keys',
        collapsed: ['schema:billing'],
        positions: { p: { x: 55, y: 66 } },
      },
    ],
  }),
};

const viaFile = (text: string) => {
  const { bytes } = importFile(text);
  return exportDeck([bytes]).json;
};

describe('views survive an export and an import (048 US5, SC-007)', () => {
  const once = viaFile(serializeDeck(file));

  it('keeps every view key, groupingMode included', () => {
    const back = JSON.parse(once) as SododeckFile;
    expect(back.groupingMode).toBe('schema');
    expect(back.views.find((v) => v.id === 'bill')).toEqual(
      file.views.find((v) => v.id === 'bill'),
    );
  });

  it('is stable on a second round', () => {
    expect(viaFile(once)).toBe(once);
  });

  it('draws the same collapse, detail and positions after the round trip', () => {
    const before = viewStateOf(file, 'bill');
    const after = viewStateOf(JSON.parse(once) as SododeckFile, 'bill');
    expect([...after.collapsed]).toEqual(['schema:billing']);
    expect([...after.collapsed]).toEqual([...before.collapsed]);
    expect(after.deck.nodes.map((n) => [n.id, n.position, n.group])).toEqual(
      before.deck.nodes.map((n) => [n.id, n.position, n.group]),
    );
    const table = after.deck.nodes.find((n) => n.id === 'p');
    if (table === undefined) throw new Error('missing table');
    expect(tableLayoutOf(table).detail).toBe('keys');
    expect(table.position).toEqual({ x: 55, y: 66 });
  });
});
