import { describe, expect, it } from 'vitest';

import { DBML_CORPUS } from '../fixtures/import/corpus';
import { deckFromDbml, readRaw } from '../fixtures/sync/deck-from-dbml';
import { writeShopDbml } from '../fixtures/sync/shop-edits';
import { shopDeck } from '../fixtures/shop';
import { schemaExport } from '../export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../export/types';
import { planSchemaSync } from './plan-schema-sync';
import type { SyncContext } from './types';
import type { SododeckFile } from '@sododeck/schema';
import { isDbTable } from '@sododeck/model';

let n = 0;
const context = (): SyncContext => ({
  scope: { kind: 'schema' },
  memory: new Map(),
  newId: (prefix) => `${prefix}.new${String(n++)}`,
  viewport: { x: 0, y: 0, width: 1000, height: 600 },
});

const writeDbml = (deck: SododeckFile) =>
  schemaExport(deck, {
    format: 'dbml',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  }).text;

describe('writer → read → plan is empty (SC-004)', () => {
  for (const dialect of ['postgres', 'mysql', 'sqlite', 'generic'] as const) {
    it(`Shop (${dialect})`, async () => {
      const deck = shopDeck(dialect);
      const raw = await readRaw(writeShopDbml(deck));
      const { plan, problems } = planSchemaSync(deck, raw, context());
      expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
      expect(plan).toMatchObject({ isEmpty: true });
    });
  }

  for (const [name, source] of Object.entries(DBML_CORPUS)) {
    it(`${name} imported into a deck`, async () => {
      const deck = await deckFromDbml(source);
      expect(deck.nodes.filter(isDbTable).length).toBeGreaterThan(0);
      const raw = await readRaw(writeDbml(deck));
      const { plan, problems } = planSchemaSync(deck, raw, context());
      expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
      expect(plan).toMatchObject({ isEmpty: true });
    });
  }
});
