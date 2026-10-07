import { readFile } from 'node:fs/promises';

import { emptySododeckFile, parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import { expect } from 'vitest';
import * as Y from 'yjs';

import {
  createEditor,
  fromJSON,
  loadDeck,
  serializeDeck,
  toJSON,
  type DeckDoc,
  type DeckEditor,
} from '../src';

/**
 * What a file becomes when it is opened and saved again: its bytes go through `loadDeck` and back
 * into `serializeDeck`, as the app's library does. For files without images this is `toJSON`.
 */
export function reopen(file: SododeckFile): SododeckFile {
  const { doc, bytes } = loadDeck(file);
  return JSON.parse(serializeDeck(doc, bytes)) as SododeckFile;
}

export async function readExample(file: string): Promise<SododeckFile> {
  const url = new URL(import.meta.resolve(`@sododeck/schema/examples/${file}`));
  return JSON.parse(await readFile(url, 'utf8')) as SododeckFile;
}

/** Deterministic id generator: `node-0`, `edge-1`, … */
export function seqIds(): (prefix: string) => string {
  let n = 0;
  return (prefix) => `${prefix}-${String(n++)}`;
}

/**
 * The deck exports a file that passes format validation (SC-007). Pictures count as exported
 * without their bytes (the document holds none), so each is written as a missing picture.
 */
export function expectValid(doc: DeckDoc): void {
  const result = parseSododeckFile(JSON.parse(serializeDeck(doc)));
  expect(result.success ? [] : result.issues).toEqual([]);
}

export interface LargeDeckSize {
  nodes: number;
  edges: number;
  flows: number;
  stepsPerFlow: number;
  rules: number;
  stickies?: number;
}

/** A valid deck with fixed ids, for performance tests (research R10). */
export function largeDeck(
  size: LargeDeckSize = {
    nodes: 500,
    edges: 1000,
    flows: 20,
    stepsPerFlow: 10,
    rules: 10,
    stickies: 0,
  },
): SododeckFile {
  const file = emptySododeckFile();
  for (let i = 0; i < size.nodes; i++) {
    file.nodes.push({
      id: `n${String(i)}`,
      type: 'service',
      title: `Service ${String(i)}`,
      description: 'Handles **things**.',
      tech: 'Go',
      tags: ['core'],
      position: { x: (i % 25) * 200, y: Math.floor(i / 25) * 120 },
    });
  }
  for (let i = 0; i < size.edges; i++) {
    file.edges.push({
      id: `e${String(i)}`,
      from: `n${String(i % size.nodes)}`,
      to: `n${String((i * 7 + 1) % size.nodes)}`,
      protocol: 'http',
      label: `POST /things/${String(i)}`,
    });
  }
  for (let r = 0; r < size.rules; r++) {
    file.rules[`R${String(r)}`] = {
      title: `Rule ${String(r)}`,
      hitPolicy: 'first',
      inputs: [
        { id: 'in1', label: 'Weight' },
        { id: 'in2', label: 'Zone' },
      ],
      outputs: [{ id: 'out1', label: 'Carrier' }],
      rows: [
        { id: 'r1', when: ['< 5', 'EU'], then: ['Post'] },
        { id: 'r2', when: ['', ''], then: ['Truck'] },
      ],
    };
  }
  for (let f = 0; f < size.flows; f++) {
    file.flows.push({
      id: `f${String(f)}`,
      title: `Flow ${String(f)}`,
      steps: Array.from({ length: size.stepsPerFlow }, (_, s) => ({
        id: `f${String(f)}s${String(s)}`,
        edge: `e${String((f * size.stepsPerFlow + s) % size.edges)}`,
        title: `Step ${String(s)}`,
        ...(s === 0
          ? {
              rules: [`R${String(f % size.rules)}`],
              ruleInputs: { [`R${String(f % size.rules)}`]: { in1: '3' } },
            }
          : {}),
      })),
    });
  }
  for (let i = 0; i < (size.stickies ?? 0); i++) {
    file.stickies.push({
      id: `sticky${String(i)}`,
      text: `Bench note ${String(i)} for service ${String(i % size.nodes)}`,
      position: { x: (i % 20) * 120, y: Math.floor(i / 20) * 96 },
    });
  }
  return file;
}

/** Which sign of the layout used before 036 a hand-built legacy document carries. */
export type LegacySign = 'collection' | 'rule' | 'description';

/**
 * A document in the layout used before 036 (layout 1), built by hand: collections as `Y.Array`,
 * a rule's columns as `Y.Array`, `meta.description` as a string. Only the chosen sign is present.
 */
export function legacyDoc(sign: LegacySign): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = doc.getMap<unknown>('meta');
    meta.set('$schema', 'https://sododeck.com/schema/v1.json');
    meta.set('version', 1);
    if (sign === 'description') meta.set('description', 'An old deck.');
    if (sign === 'collection') {
      const node = new Y.Map<unknown>();
      node.set('id', 'n');
      node.set('type', 'service');
      node.set('title', 'Old');
      doc.getArray('nodes').push([node]);
    }
    if (sign === 'rule') {
      const rule = new Y.Map<unknown>();
      rule.set('title', 'Old rule');
      rule.set('hitPolicy', 'first');
      for (const field of ['inputs', 'outputs', 'rows']) rule.set(field, new Y.Array());
      doc.getMap('rules').set('R', rule);
    }
  });
  return doc;
}

/** A copy of `doc` loaded from its update bytes, as storage would load it. */
export function reload(doc: Y.Doc): Y.Doc {
  const copy = new Y.Doc();
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
  return copy;
}

/** One side of a two-document test: a document and its editor. */
export interface Side {
  doc: DeckDoc;
  editor: DeckEditor;
}

/**
 * Two documents holding the same deck, as two tabs would: `b` is loaded from `a`'s state. Each
 * editor generates its own ids (`node-a0`, `node-b0`, …), as two clients' random ids never collide.
 */
export function twoDocs(file: SododeckFile): { a: Side; b: Side } {
  const docA = fromJSON(file);
  const docB = reload(docA);
  const ids = (side: string) => {
    let n = 0;
    return (prefix: string) => `${prefix}-${side}${String(n++)}`;
  };
  return {
    a: { doc: docA, editor: createEditor(docA, { newId: ids('a') }) },
    b: { doc: docB, editor: createEditor(docB, { newId: ids('b') }) },
  };
}

/** Exchanges what each side is missing, delivering `a`'s changes first (`ab`) or `b`'s (`ba`). */
export function sync(a: Side, b: Side, order: 'ab' | 'ba' = 'ab'): void {
  const toB = Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc));
  const toA = Y.encodeStateAsUpdate(b.doc, Y.encodeStateVector(a.doc));
  if (order === 'ab') {
    Y.applyUpdate(b.doc, toB);
    Y.applyUpdate(a.doc, toA);
  } else {
    Y.applyUpdate(a.doc, toA);
    Y.applyUpdate(b.doc, toB);
  }
}

/** Both sides read as the same deck, every list in the same order (036 contract guarantee 1). */
export function expectConverged(a: Side, b: Side): void {
  const left = toJSON(a.doc);
  expect(toJSON(b.doc)).toEqual(left);
  expect(serializeDeck(toJSON(b.doc))).toBe(serializeDeck(left));
}

/**
 * Runs a two-sided scenario once per delivery order: `editA` on one side, `editB` on the other,
 * then a sync. Asserts convergence before handing both sides to `check`.
 */
export function bothOrders(
  file: SododeckFile,
  editA: (side: Side) => void,
  editB: (side: Side) => void,
  check: (a: Side, b: Side) => void,
): void {
  for (const order of ['ab', 'ba'] as const) {
    const { a, b } = twoDocs(file);
    editA(a);
    editB(b);
    sync(a, b, order);
    expectConverged(a, b);
    check(a, b);
  }
}

/**
 * A small database schema (040): customers, orders, order items (composite key), shipments (a
 * composite reference to items) and categories (a self-reference), one enum, indexes and a check.
 */
export function shopDeck(): SododeckFile {
  return {
    ...emptySododeckFile(),
    dialect: 'postgres',
    enums: [
      {
        id: 'e-status',
        name: 'customer_status',
        values: [
          { id: 'ev-active', name: 'active' },
          { id: 'ev-blocked', name: 'blocked', note: 'No orders.' },
        ],
      },
    ],
    nodes: [
      { id: 'db', type: 'database', title: 'Shop' },
      {
        id: 'customers',
        type: 'db-table',
        title: 'customers',
        parent: 'db',
        columns: [
          { id: 'c-id', name: 'id', type: 'bigint', pk: true },
          { id: 'c-email', name: 'email', type: 'varchar', size: '255', notNull: true },
          { id: 'c-status', name: 'status', type: 'customer_status', enumRef: 'e-status' },
        ],
      },
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        parent: 'db',
        columns: [
          { id: 'o-id', name: 'id', type: 'bigint', pk: true },
          { id: 'o-customer', name: 'customer_id', type: 'bigint', notNull: true },
          { id: 'o-total', name: 'total', type: 'numeric', size: '10,2' },
        ],
        indexes: [
          { id: 'ix-customer', columns: ['o-customer'] },
          { id: 'ix-mixed', name: 'orders_mixed', columns: ['o-customer', 'o-total'] },
          { id: 'ix-expr', columns: [{ expr: 'lower(note)' }] },
        ],
        checks: [{ id: 'ck-total', name: 'total_positive', expr: 'total >= 0' }],
      },
      {
        id: 'items',
        type: 'db-table',
        title: 'order_items',
        columns: [
          { id: 'i-order', name: 'order_id', type: 'bigint', pk: true },
          { id: 'i-line', name: 'line_no', type: 'integer', pk: true },
          { id: 'i-qty', name: 'quantity', type: 'integer' },
        ],
      },
      {
        id: 'shipments',
        type: 'db-table',
        title: 'shipments',
        columns: [
          { id: 's-id', name: 'id', type: 'bigint', pk: true },
          { id: 's-order', name: 'order_id', type: 'bigint' },
          { id: 's-line', name: 'line_no', type: 'integer' },
        ],
      },
      {
        id: 'categories',
        type: 'db-table',
        title: 'categories',
        columns: [
          { id: 'cat-id', name: 'id', type: 'bigint', pk: true },
          { id: 'cat-parent', name: 'parent_id', type: 'bigint', enumRef: 'e-status' },
        ],
      },
    ],
    edges: [
      {
        id: 'r-orders-customer',
        from: 'orders',
        to: 'customers',
        fromColumns: ['o-customer'],
        toColumns: ['c-id'],
        cardinality: 'n-1',
        onDelete: 'cascade',
      },
      {
        id: 'r-ship-item',
        from: 'shipments',
        to: 'items',
        fromColumns: ['s-order', 's-line'],
        toColumns: ['i-order', 'i-line'],
        cardinality: 'n-1',
      },
      {
        id: 'r-cat-parent',
        from: 'categories',
        to: 'categories',
        fromColumns: ['cat-parent'],
        toColumns: ['cat-id'],
        fromOptional: true,
      },
    ],
  };
}

/**
 * A database schema of `tables` tables × `columns` columns with `relationships` foreign keys
 * (040 SC-005), fixed ids: table `t<i>`, column `t<i>c<j>`, relationship `r<k>`. Column 0 is the
 * key; each relationship joins column 1 of one table to the key of another.
 */
export function largeSchemaDeck(tables = 150, columns = 12, relationships = 200): SododeckFile {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    dialect: 'postgres',
    enums: [
      {
        id: 'status',
        name: 'status',
        values: [
          { id: 'status-a', name: 'active' },
          { id: 'status-b', name: 'blocked' },
        ],
      },
    ],
  };
  for (let t = 0; t < tables; t++) {
    const id = `t${String(t)}`;
    file.nodes.push({
      id,
      type: 'db-table',
      title: `table_${String(t)}`,
      position: { x: (t % 15) * 300, y: Math.floor(t / 15) * 400 },
      columns: Array.from({ length: columns }, (_, c) => ({
        id: `${id}c${String(c)}`,
        name: c === 0 ? 'id' : `column_${String(c)}`,
        type: c <= 1 ? 'bigint' : c === 2 ? 'status' : 'text',
        ...(c === 0 ? { pk: true } : {}),
        ...(c === 2 ? { enumRef: 'status' } : {}),
      })),
      indexes: [{ id: `${id}i0`, columns: [`${id}c1`, `${id}c2`] }],
      checks: [{ id: `${id}k0`, expr: 'id > 0' }],
    });
  }
  for (let r = 0; r < relationships; r++) {
    const from = r % tables;
    // Shifted every lap so no two relationships are copies (047 lint stays clean).
    const to = (r * 7 + 1 + Math.floor(r / tables)) % tables;
    file.edges.push({
      id: `r${String(r)}`,
      from: `t${String(from)}`,
      to: `t${String(to)}`,
      fromColumns: [`t${String(from)}c1`],
      toColumns: [`t${String(to)}c0`],
      cardinality: 'n-1',
    });
  }
  return file;
}

const empty = emptySododeckFile();
const { $schema, version, ...collections } = empty;

/** One case per object type, each with every optional field (US2 AS1, FR-023). */
export const perTypeDecks: [string, SododeckFile][] = [
  [
    'deck metadata',
    {
      $schema,
      version,
      name: 'Delivery',
      description: 'Last-mile **delivery**.',
      tags: ['a', 'b'],
      swatches: ['#7a3cff', '#1f2a44'],
      ...collections,
    },
  ],
  [
    'node',
    {
      ...empty,
      nodes: [
        { id: 'p', type: 'external', title: 'Parent' },
        {
          id: 'n',
          type: 'service',
          title: 'Orders',
          level: 'container',
          description: 'Takes **orders**.',
          owner: 'Team A',
          tags: ['core'],
          tech: 'Go',
          host: 'EKS',
          icon: 'server',
          links: [{ label: 'Repo', url: 'https://example.com' }, { url: '/docs' }],
          group: 'g',
          parent: 'p',
          rules: ['R-1'],
          position: { x: -1.5, y: 20 },
          size: { width: 244, height: 80 },
          style: { fill: 'red', stroke: '#1f2a44' },
        },
      ],
      groups: [{ id: 'g', title: 'G' }],
      rules: { 'R-1': { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
    },
  ],
  [
    'group',
    {
      ...empty,
      groups: [
        { id: 'outer', title: 'Outer' },
        {
          id: 'g',
          title: 'Inner',
          description: 'Nested',
          parent: 'outer',
          style: { fill: 'amber' },
        },
      ],
    },
  ],
  [
    'card style (020)',
    {
      $schema,
      version,
      swatches: Array.from({ length: 14 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`),
      ...collections,
      nodes: [
        { id: 'a', type: 'client', title: 'A', style: { fill: 'red' } },
        { id: 'b', type: 'client', title: 'B', style: { stroke: '#123abc' } },
        { id: 'c', type: 'client', title: 'C', style: { fill: 'blue', stroke: 'green' } },
      ],
      groups: [{ id: 'g', title: 'G', style: { fill: '#abcdef', stroke: 'violet' } }],
    },
  ],
  [
    'tag colours: named, hex, mixed-case keys, sorted by key (033)',
    {
      $schema,
      version,
      tagColors: { Lan: '#7a3cff', PCI: 'violet', 'pci-dss': 'red', 'Zone A': 'slate' },
      ...collections,
      nodes: [{ id: 'a', type: 'client', title: 'A', tags: ['PCI', 'pic', 'Lan'] }],
    },
  ],
  [
    'group frames and per-view frames (016)',
    {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A', group: 'framed', position: { x: 40, y: 80 } }],
      groups: [
        {
          id: 'framed',
          title: 'Framed',
          parent: 'plain',
          position: { x: 16, y: 56.5 },
          size: { width: 212, height: 152 },
        },
        { id: 'plain', title: 'No frame yet' },
      ],
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        {
          id: 'v2',
          type: 'infra',
          title: 'Two',
          positions: { a: { x: 300, y: 0 } },
          groupFrames: {
            framed: { position: { x: 276, y: -24 }, size: { width: 400, height: 300 } },
          },
        },
      ],
    },
  ],
  // 048: grouping mode, view schemas and view detail (and a collapsed schema group id).
  [
    'grouping mode and view filters',
    {
      $schema,
      version,
      groupingMode: 'schema',
      ...collections,
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        {
          id: 'v2',
          type: 'custom',
          title: 'Billing',
          schemas: ['billing', 'public'],
          collapsed: ['schema:billing'],
          detail: 'keys',
        },
      ],
    },
  ],
  [
    'edge',
    {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      edges: [
        {
          id: 'e',
          from: 'a',
          to: 'a',
          protocol: 'grpc',
          label: 'Call',
          direction: 'both',
          description: 'Loop',
          owner: 'Team',
          tags: ['t'],
          links: [{ url: 'https://example.com' }],
          route: { fromSide: 'right', toSide: 'left', offset: -12 },
        },
      ],
    },
  ],
  [
    'view',
    {
      ...empty,
      nodes: [
        { id: 'a', type: 'client', title: 'A' },
        { id: 'b', type: 'client', title: 'B' },
      ],
      features: [{ id: 'f', title: 'F' }],
      views: [
        {
          id: 'v',
          type: 'feature',
          title: 'V',
          subtitleField: 'owner',
          feature: 'f',
          includes: ['b', 'a'],
          positions: { b: { x: 1, y: 2 }, a: { x: -3, y: 0.25 } },
        },
      ],
    },
  ],
  [
    'view with every 011 field',
    {
      ...empty,
      nodes: [
        { id: 'a', type: 'client', title: 'A', tags: ['legacy'] },
        { id: 'b', type: 'service', title: 'B', group: 'g' },
      ],
      groups: [
        { id: 'g', title: 'G' },
        { id: 'h', title: 'H', parent: 'g' },
      ],
      features: [{ id: 'f', title: 'F' }],
      views: [
        { id: 'system', type: 'system', title: 'System', collapsed: ['h', 'g'] },
        {
          id: 'v',
          type: 'custom',
          title: 'V',
          subtitleField: 'flows',
          feature: 'f',
          includes: ['b', 'a'],
          excludeGroups: ['h'],
          excludeKinds: ['external', 'client'],
          excludeTags: ['legacy', 'pci'],
          dimKinds: ['database'],
          positions: { b: { x: 1, y: 2 } },
          pinned: ['b', 'a'],
          collapsed: ['g'],
        },
      ],
    },
  ],
  ['feature', { ...empty, features: [{ id: 'f', title: 'F', description: 'D', owner: 'O' }] }],
  [
    'flow and step',
    {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      edges: [{ id: 'e', from: 'a', to: 'a' }],
      features: [{ id: 'f', title: 'F' }],
      flows: [
        {
          id: 'fl',
          title: 'Flow',
          feature: 'f',
          description: 'D',
          trigger: 'T',
          outcome: 'O',
          owner: 'Team',
          tags: ['x'],
          links: [{ label: 'L', url: 'u' }],
          steps: [
            {
              id: 's',
              edge: 'e',
              title: 'Step',
              condition: 'C',
              sla: '< 1 s',
              description: 'D',
              payload: 'P',
              notes: 'N',
              owner: 'O',
              tags: ['y'],
              links: [{ url: 'u' }],
              rules: ['R-2', 'R-1'],
              ruleInputs: { 'R-2': { i2: 'b', i1: 'a' }, 'R-1': { i1: '' } },
            },
          ],
        },
      ],
      rules: {
        'R-2': {
          title: 'Two',
          hitPolicy: 'collect',
          inputs: [
            { id: 'i1', label: 'One' },
            { id: 'i2', label: 'Two' },
          ],
          outputs: [],
          rows: [],
        },
        'R-1': {
          title: 'One',
          hitPolicy: 'first',
          inputs: [{ id: 'i1', label: 'One' }],
          outputs: [],
          rows: [],
        },
      },
    },
  ],
  [
    'flow with branches (006)',
    {
      ...empty,
      nodes: [
        { id: 'a', type: 'client', title: 'A' },
        { id: 'b', type: 'service', title: 'B' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'ba', from: 'b', to: 'a' },
      ],
      flows: [
        {
          id: 'f',
          title: 'Pay',
          branches: [
            { id: 'ok', label: '', condition: '' },
            {
              id: 'fail',
              label: 'payment failed',
              condition: 'declined',
              errorPath: true,
              description: 'Ask **again**.',
            },
          ],
          steps: [
            { id: 's1', edge: 'ab' },
            { id: 's2a', edge: 'ba', branch: 'ok', title: 'Back' },
            { id: 's2b', edge: 'gone', branch: 'fail' },
          ],
        },
        { id: 'g', title: 'Empty branches list', branches: [], steps: [] },
      ],
    },
  ],
  [
    'rule',
    {
      ...empty,
      rules: {
        'R-1': {
          title: 'Carrier',
          description: 'Picks one.',
          hitPolicy: 'unique',
          inputs: [
            { id: 'in1', label: 'Weight' },
            { id: 'in2', label: 'Zone' },
          ],
          outputs: [{ id: 'out1', label: 'Carrier' }],
          rows: [
            { id: 'r1', when: ['< 5', ''], then: ['Post'] },
            { id: 'r2', when: ['', 'EU'], then: [''] },
          ],
        },
      },
    },
  ],
  [
    'knowledge layer (008): rules on nodes and steps, sample inputs, tags and links everywhere',
    {
      $schema,
      version,
      name: 'Delivery',
      description: 'Picks **tiers**.',
      tags: ['logistics'],
      nodes: [
        {
          id: 'a',
          type: 'client',
          title: 'App',
          owner: 'Mobile',
          tags: ['edge'],
          links: [
            {
              label: 'example.com',
              url: 'https://example.com/app',
            },
            {
              url: 'docs/app.md',
            },
          ],
        },
        {
          id: 'p',
          type: 'service',
          title: 'Pricing',
          tags: ['pricing', 'pci'],
          tech: 'Python',
          host: 'eu-west k8s',
          links: [
            {
              label: 'Runbook',
              url: 'https://runbooks.example.com/pricing',
            },
          ],
          rules: ['T', 'U'],
        },
      ],
      groups: [],
      edges: [
        {
          id: 'ap',
          from: 'a',
          to: 'p',
          protocol: 'grpc',
          label: 'quote',
          direction: 'both',
          description: 'Asks for a `quote`.',
          owner: 'Orders',
          tags: ['sync'],
          links: [
            {
              url: '/specs/quote',
            },
          ],
        },
      ],
      views: [],
      features: [],
      flows: [
        {
          id: 'f',
          title: 'Place order',
          owner: 'Orders',
          tags: ['checkout'],
          links: [
            {
              label: 'Brief',
              url: 'https://example.com/brief',
            },
          ],
          steps: [
            {
              id: 's',
              edge: 'ap',
              owner: 'Orders',
              tags: ['quote'],
              links: [
                {
                  url: 'https://example.com/step',
                },
              ],
              rules: ['T', 'U'],
              ruleInputs: {
                T: {
                  dist: '5',
                  prio: 'Express',
                },
                U: {
                  x: '1',
                },
              },
            },
          ],
        },
      ],
      rules: {
        T: {
          title: 'Delivery tier',
          hitPolicy: 'first',
          inputs: [
            {
              id: 'dist',
              label: 'Distance (km)',
            },
            {
              id: 'prio',
              label: 'Priority',
            },
          ],
          outputs: [
            {
              id: 'veh',
              label: 'Vehicle',
            },
          ],
          rows: [
            {
              id: 'r1',
              when: ['≤ 5', 'Express'],
              then: ['Bike'],
            },
          ],
        },
        U: {
          title: 'Other',
          hitPolicy: 'collect',
          inputs: [
            {
              id: 'x',
              label: 'X',
            },
          ],
          outputs: [],
          rows: [],
        },
      },
      stickies: [],
    },
  ],
  [
    'sticky',
    {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      stickies: [
        { id: 's1', text: 'Coloured', color: 'blue', position: { x: 0, y: 0 } },
        { id: 's2', text: 'Free', color: 'grey', position: { x: 1, y: 1 } },
        { id: 's3', text: '', position: { x: 0, y: -8 } },
        { id: 's4', text: 'Collapsed', position: { x: 2, y: 2 }, collapsed: true },
        { id: 's5', text: 'Not collapsed', position: { x: 3, y: 3 }, collapsed: false },
        { id: 's6', text: 'Stays visible', position: { x: 4, y: 4 }, showInFlows: true },
        { id: 's7', text: 'Dims normally', position: { x: 5, y: 5 }, showInFlows: false },
        {
          id: 's8',
          text: 'Collapsed, stays visible',
          position: { x: 6, y: 6 },
          collapsed: true,
          showInFlows: true,
        },
      ],
    },
  ],
];
