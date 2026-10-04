import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { shopDeck } from '../fixtures/shop';
import { availableSchemaScopes, defaultSchemaScope, scopeLabel, tablesInScope } from './scope';

const shop = shopDeck('postgres');

describe('availableSchemaScopes', () => {
  it('keeps only selected tables, in deck order', () => {
    const scopes = availableSchemaScopes(shop, {
      selection: ['orders', 'svc.checkout', 'customers'],
      drill: [],
    });
    expect(scopes.selection).toEqual(['customers', 'orders']);
    expect(scopes.database).toBeNull();
    expect(defaultSchemaScope(scopes)).toBe('selection');
  });

  it('offers the drilled-into database card first, else one selected card', () => {
    const drilled = availableSchemaScopes(shop, {
      selection: ['card.users-db'],
      drill: [{ kind: 'node', id: 'card.orders-db' }],
    });
    expect(drilled.database).toEqual({ cardId: 'card.orders-db', title: 'Orders DB' });
    expect(defaultSchemaScope(drilled)).toBe('database');
    const selected = availableSchemaScopes(shop, { selection: ['card.users-db'], drill: [] });
    expect(selected.database).toEqual({ cardId: 'card.users-db', title: 'Users DB' });
    const two = availableSchemaScopes(shop, {
      selection: ['card.users-db', 'card.orders-db'],
      drill: [],
    });
    expect(two.database).toBeNull();
  });

  it('ignores a drilled group or non-database card', () => {
    const scopes = availableSchemaScopes(shop, {
      selection: [],
      drill: [{ kind: 'node', id: 'svc.checkout' }],
    });
    expect(scopes.database).toBeNull();
    expect(defaultSchemaScope(scopes)).toBe('deck');
  });

  it('knows whether the deck has tables', () => {
    const empty: SododeckFile = { ...shop, nodes: shop.nodes.filter((n) => n.type !== 'db-table') };
    expect(availableSchemaScopes(empty, { selection: [], drill: [] }).deckHasTables).toBe(false);
    expect(availableSchemaScopes(shop, { selection: [], drill: [] }).deckHasTables).toBe(true);
  });
});

describe('tablesInScope', () => {
  it('writes tables only', () => {
    expect(tablesInScope(shop, { kind: 'selection', tableIds: ['svc.checkout', 'users'] })).toEqual(
      ['users'],
    );
    expect(tablesInScope(shop, { kind: 'database', cardId: 'card.users-db' })).toEqual([
      'users',
      'sessions',
    ]);
    expect(tablesInScope(shop, { kind: 'deck' })).toHaveLength(13);
    expect(tablesInScope(shop, { kind: 'database', cardId: 'svc.checkout' })).toEqual([]);
  });

  it('labels scopes', () => {
    expect(scopeLabel(shop, { kind: 'database', cardId: 'card.orders-db' })).toBe('Orders DB');
    expect(scopeLabel(shop, { kind: 'deck' })).toBe('Whole deck');
    expect(scopeLabel(shop, { kind: 'selection', tableIds: [] })).toBe('Selection');
  });
});
