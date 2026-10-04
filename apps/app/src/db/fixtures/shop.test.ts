import { checkDeck, fromJSON, toJSON } from '@sododeck/model';
import { parseSododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { shopDeck } from './shop';

describe('shopDeck', () => {
  it.each(['generic', 'postgres', 'mysql', 'sqlite'] as const)(
    'is a valid deck with no problems (%s)',
    (dialect) => {
      const deck = shopDeck(dialect);
      const parsed = parseSododeckFile(deck);
      expect(parsed.success ? [] : parsed.issues).toEqual([]);
      expect(toJSON(fromJSON(deck))).toEqual(deck);
      expect(checkDeck(deck).list.filter((p) => p.kind.startsWith('db-'))).toEqual([]);
    },
  );

  it('holds the dialect native types', () => {
    const column = (dialect: 'mysql' | 'sqlite', table: string, name: string) =>
      shopDeck(dialect)
        .nodes.find((n) => n.id === table)
        ?.columns?.find((c) => c.name === name);
    expect(column('mysql', 'orders', 'id')).toMatchObject({ type: 'char', size: '36' });
    expect(column('sqlite', 'orders', 'id')).toMatchObject({ type: 'text' });
    expect(column('sqlite', 'orders', 'total')).not.toHaveProperty('size');
  });
});
