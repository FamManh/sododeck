/**
 * The schema export's edge cases (045 T004): a Generic deck whose "Edge DB" card scope hits every
 * `ExportNote` kind the default options can produce, plus `nameClashDeck` (two `invoices` in
 * different schemas, kept apart because SQLite cannot run it). Pure data.
 */
import type { DbColumn, Edge, Node, SododeckFile } from '@sododeck/schema';

import type { ExportNoteKind } from '../export/notes';
import type { SchemaExportRequest, SchemaFormat, SqlDialect } from '../export/types';
import { DEFAULT_SQL_OPTIONS } from '../export/types';

export const EDGE_CARD = 'card.edge';

type Spec = Omit<DbColumn, 'id'>;

function table(
  id: string,
  title: string,
  columns: Spec[],
  extra: Partial<Node> = {},
  parent: string | null = EDGE_CARD,
): Node {
  return {
    id,
    type: 'db-table',
    title,
    ...(parent === null ? {} : { parent }),
    columns: columns.map((c, i) => ({ id: `${id}.c${String(i)}`, ...c })),
    ...extra,
  };
}

const int = (name: string, extra: Partial<Spec> = {}): Spec => ({ name, type: 'int', ...extra });

function deck(nodes: Node[], edges: Edge[], extra: Partial<SododeckFile> = {}): SododeckFile {
  return {
    $schema: 'https://sododeck.com/schema/v1.json',
    version: 1,
    name: 'Edge cases',
    packs: ['architecture', 'database'],
    nodes,
    groups: [],
    edges,
    views: [],
    features: [],
    flows: [],
    rules: {},
    stickies: [],
    ...extra,
  };
}

export function edgeCaseDeck(): SododeckFile {
  const nodes: Node[] = [
    { id: EDGE_CARD, type: 'database', title: 'Edge DB' },
    // Reserved and mixed-case names.
    table('t.order', 'order', [int('id', { pk: true }), int('UserId')]),
    table('t.order-items', 'order items', [
      int('id', { pk: true }),
      int('order_id', { notNull: true }),
      { name: 'line note', type: 'text', note: 'Quotes \' and " and -- dashes' },
    ]),
    // A mutual cycle.
    table('t.a', 'a', [int('id', { pk: true }), int('b_id')]),
    table('t.b', 'b', [int('id', { pk: true }), int('a_id')]),
    // Stale references.
    table(
      't.stale',
      'stale',
      [int('id', { pk: true }), { name: 'mood', type: 'text', enumRef: 'enum.gone' }],
      {
        indexes: [{ id: 't.stale.ix', name: 'stale_idx', columns: ['t.stale.gone', 't.stale.c0'] }],
      },
    ),
    // Composite keys of different lengths, a relationship with no columns, one with no cardinality.
    table('t.pairs', 'pairs', [int('x', { pk: true }), int('y', { pk: true })]),
    table('t.pair-refs', 'pair_refs', [int('id', { pk: true }), int('x'), int('a_id')]),
    // Odd columns.
    table(
      't.misc',
      'misc',
      [
        int('id', { pk: true }),
        { name: 'blank', type: ' ' },
        { name: 'empty_choice', type: 'empty_choice', enumRef: 'enum.empty' },
        { name: 'code', type: 'text', increment: true },
        { name: 'data', type: 'json' },
        { name: 'price', type: 'money' },
        { name: 'label', type: 'varchar' },
        { name: 'flag', type: 'bool', notNull: true, default: false },
      ],
      {
        indexes: [
          { id: 't.misc.data', name: 'misc_data_idx', columns: ['t.misc.c4'], method: 'gin' },
        ],
      },
    ),
    {
      id: 't.unnamed',
      type: 'db-table',
      title: ' ',
      parent: EDGE_CARD,
      columns: [int('id', { pk: true })].map((c) => ({ id: 't.unnamed.c0', ...c })),
    },
    // Schemas: one table inside the card, its referenced table outside it.
    table('t.ledgers', 'ledgers', [int('id', { pk: true }), { name: 'account_id', type: 'uuid' }], {
      schema: 'billing',
    }),
    table(
      't.accounts',
      'accounts',
      [{ name: 'id', type: 'uuid', pk: true }],
      { schema: 'billing' },
      null,
    ),
    table('t.public-notes', 'notes', [int('id', { pk: true })], { schema: 'public' }),
    // Junction name clash, self n–n and an n–n side without a key.
    table('t.products', 'products', [int('id', { pk: true })]),
    table('t.categories', 'categories', [int('id', { pk: true })]),
    table('t.products-categories', 'products_categories', [int('id', { pk: true })]),
    table('t.tags', 'tags', [
      int('id', { pk: true }),
      { name: 'name', type: 'varchar', size: '40' },
    ]),
    table('t.keyless', 'keyless', [int('v')]),
  ];
  const rel = (id: string, edge: Omit<Edge, 'id'>): Edge => ({ id, ...edge });
  const edges: Edge[] = [
    rel('r.items-order', {
      from: 't.order-items',
      to: 't.order',
      fromColumns: ['t.order-items.c1'],
      toColumns: ['t.order.c0'],
      cardinality: 'n-1',
      onDelete: 'cascade',
    }),
    rel('r.a-b', {
      from: 't.a',
      to: 't.b',
      fromColumns: ['t.a.c1'],
      toColumns: ['t.b.c0'],
      cardinality: 'n-1',
    }),
    rel('r.b-a', {
      from: 't.b',
      to: 't.a',
      fromColumns: ['t.b.c1'],
      toColumns: ['t.a.c0'],
      cardinality: 'n-1',
    }),
    rel('r.mismatch', {
      from: 't.pair-refs',
      to: 't.pairs',
      fromColumns: ['t.pair-refs.c1'],
      toColumns: ['t.pairs.c0', 't.pairs.c1'],
      cardinality: 'n-1',
    }),
    rel('r.no-columns', {
      from: 't.pair-refs',
      to: 't.misc',
      cardinality: 'n-1',
      label: 'mentions',
    }),
    rel('r.no-cardinality', {
      from: 't.pair-refs',
      to: 't.a',
      fromColumns: ['t.pair-refs.c2'],
      toColumns: ['t.a.c0'],
    }),
    rel('r.stale', {
      from: 't.stale',
      to: 't.a',
      fromColumns: ['t.stale.gone'],
      toColumns: ['t.a.c0'],
      cardinality: 'n-1',
    }),
    rel('r.ledgers-accounts', {
      from: 't.ledgers',
      to: 't.accounts',
      fromColumns: ['t.ledgers.c1'],
      toColumns: ['t.accounts.c0'],
      cardinality: 'n-1',
    }),
    rel('r.products-categories', { from: 't.products', to: 't.categories', cardinality: 'n-n' }),
    rel('r.tags-tags', { from: 't.tags', to: 't.tags', cardinality: 'n-n', label: 'related' }),
    rel('r.products-keyless', { from: 't.products', to: 't.keyless', cardinality: 'n-n' }),
  ];
  return deck(nodes, edges, {
    enums: [{ id: 'enum.empty', name: 'empty_choice', values: [] }],
  });
}

/** Two tables named `invoices`, in `billing` and `public`: runs on Postgres, clashes on SQLite. */
export function nameClashDeck(): SododeckFile {
  return deck(
    [
      table('t.invoices', 'invoices', [int('id', { pk: true })], {}, null),
      table(
        't.billing-invoices',
        'invoices',
        [int('id', { pk: true })],
        { schema: 'billing' },
        null,
      ),
    ],
    [],
    { name: 'Name clash' },
  );
}

/** The edge-case export request: the "Edge DB" card, default options. */
export function edgeCaseRequest(
  format: SchemaFormat,
  dialect: SqlDialect | null,
): SchemaExportRequest {
  return {
    format,
    scope: { kind: 'database', cardId: EDGE_CARD },
    dialect,
    sql: DEFAULT_SQL_OPTIONS,
  };
}

const COMMON: readonly ExportNoteKind[] = [
  'fk-out-of-scope',
  'stale-reference',
  'empty-type',
  'unnamed-table',
];

const REFERENCES: readonly ExportNoteKind[] = ['length-mismatch', 'no-columns', 'no-key'];

const SQL: readonly ExportNoteKind[] = [
  ...COMMON,
  ...REFERENCES,
  'unmapped-type',
  'self-junction',
  'junction-renamed',
  'increment-dropped',
];

/**
 * Note kinds each format / dialect must report for `edgeCaseRequest` (SC-006). The exact messages
 * are pinned by `schema-export.test.ts`.
 */
export const expectedNoteKinds: Record<
  'sql-postgres' | 'sql-mysql' | 'sql-sqlite' | 'dbml' | 'mermaid-er' | 'dictionary',
  readonly ExportNoteKind[]
> = {
  'sql-postgres': SQL,
  'sql-mysql': [...SQL, 'default-size', 'method-dropped', 'empty-enum'],
  'sql-sqlite': [...SQL, 'schema-dropped', 'method-dropped', 'empty-enum'],
  dbml: [...COMMON, ...REFERENCES, 'method-dropped', 'empty-enum', 'same-column-ref'],
  'mermaid-er': [...COMMON, 'no-cardinality', 'name-changed'],
  dictionary: COMMON,
};
