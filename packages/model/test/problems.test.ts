import { readFile } from 'node:fs/promises';

import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { checkDeck, PROBLEM_KINDS, SEVERITY, type Problem, type ProblemKind } from '../src';
import { readExample, shopDeck } from './helpers';

type NodeData = SododeckFile['nodes'][number];
const node = (id: string, extra: Partial<NodeData> = {}): NodeData => ({
  id,
  type: 'service',
  title: id.toUpperCase(),
  ...extra,
});
const edge = (id: string, from: string, to: string, label?: string) =>
  label === undefined ? { id, from, to } : { id, from, to, label };
const anyRow = (id: string) => ({ id, when: [''], then: ['x'] });
const rule = (title: string, rows = [anyRow('r1')]) => ({
  title,
  hitPolicy: 'first' as const,
  inputs: [{ id: 'in1', label: 'In' }],
  outputs: [{ id: 'out1', label: 'Out' }],
  rows,
});

function deck(patch: Partial<SododeckFile>): SododeckFile {
  return { ...emptySododeckFile(), ...patch };
}
const kinds = (file: SododeckFile) => checkDeck(file).list.map((p) => p.kind);
const only = (file: SododeckFile): Problem => {
  const { list } = checkDeck(file);
  expect(list).toHaveLength(1);
  const [first] = list;
  if (first === undefined) throw new Error('no problem');
  return first;
};

/** a → b → c, all connected. */
const chain = () => ({
  nodes: [node('a'), node('b'), node('c')],
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')],
});

describe('checkDeck (015)', () => {
  describe('bundled decks (SC-001)', () => {
    it('finds nothing in the minimal example or an empty deck', async () => {
      expect(checkDeck(await readExample('minimal.sododeck.json')).total).toBe(0);
      expect(checkDeck(emptySododeckFile())).toEqual({
        list: [],
        total: 0,
        errors: 0,
        warnings: 0,
        byObject: new Map(),
      });
    });

    // These examples contain real problems (a request that returns to the gateway breaks the
    // chain under 006's rule, rules without a catch-all row); the list must name exactly those.
    it('lists exactly the known problems of the richer examples', async () => {
      const list = async (name: string) =>
        checkDeck(await readExample(`${name}.sododeck.json`)).list.map((p) => p.kind);
      expect(await list('flow-and-rule')).toEqual(['broken-chain', 'rule-without-catch-all']);
      expect(await list('full')).toEqual([
        'broken-chain',
        'incomplete-flow',
        'rule-without-catch-all',
        'rule-without-catch-all',
        // 047: the n–n "tagged with" and the 1–1 "latest order" (orders.customer_id is not unique).
        'db-fk-not-key',
        'db-many-to-many',
      ]);
    });

    it('lists exactly the known problems of the 008 logistics deck', async () => {
      const url = new URL(
        '../../../specs/008-inspector-rules/screens/logistics.sododeck.json',
        import.meta.url,
      );
      const file = JSON.parse(await readFile(url, 'utf8')) as SododeckFile;
      expect(checkDeck(file).list.map((p) => p.detail)).toEqual([
        "Place order · step 4 doesn't continue from step 3",
        "Place order · step 5 doesn't continue from step 4",
        "Reattempt policy · 1 cell can't be read",
        'Delivery tier · some inputs match no row',
        'Reattempt policy · some inputs match no row',
      ]);
    });
  });

  describe('components without connections', () => {
    // Founder decision (2026-09-28): a diagram may hold components that are not connected yet,
    // or never will be; that is not a problem to report.
    it('never reports a component with no connections', () => {
      expect(
        kinds(deck({ ...chain(), nodes: [...chain().nodes, node('x', { title: 'Legacy' })] })),
      ).toEqual([]);
      expect(kinds(deck({ nodes: [node('a'), node('b'), node('c')] }))).toEqual([]);
    });
  });

  describe('card size out of range (017, research R11)', () => {
    it('reports a node with an out-of-range size, targeting the component', () => {
      const file = deck({
        nodes: [node('a', { title: 'API Gateway', size: { width: 900, height: 40 } })],
      });
      const problem = only(file);
      expect(problem.kind).toBe('card-size-out-of-range');
      expect(problem.target).toEqual({ type: 'node', id: 'a' });
      expect(problem.detail).toBe(
        'API Gateway has a size of 900 × 40; allowed 120 × 44 to 800 × 600',
      );
    });

    it('reports nothing for in-range sizes, absent sizes, or exactly the limits', () => {
      const file = deck({
        nodes: [
          node('a', { size: { width: 200, height: 72 } }),
          node('b'),
          node('c', { size: { width: 120, height: 44 } }),
          node('d', { size: { width: 800, height: 600 } }),
        ],
      });
      expect(kinds(file)).toEqual([]);
    });

    it('uses each shape’s own minimum (031)', () => {
      const file = deck({
        nodes: [
          node('a', { type: 'text', size: { width: 40, height: 24 } }),
          node('b', { type: 'diamond', size: { width: 80, height: 56 } }),
          node('c', { type: 'database', display: 'shape', size: { width: 64, height: 56 } }),
        ],
      });
      expect(kinds(file)).toEqual([]);
      const small = deck({
        nodes: [node('d', { type: 'diamond', title: 'OK?', size: { width: 70, height: 56 } })],
      });
      expect(only(small).detail).toBe('OK? has a size of 70 × 56; allowed 80 × 56 to 800 × 600');
    });
  });

  describe('duplicate connections', () => {
    it('reports copies with the same source, target and label once, with the count', () => {
      const file = deck({
        nodes: [node('a', { title: 'API Gateway' }), node('b', { title: 'Tracking' })],
        edges: [edge('e1', 'a', 'b', 'GPS  stream'), edge('e2', 'a', 'b', ' gps stream ')],
      });
      expect(only(file)).toMatchObject({
        kind: 'duplicate-connection',
        detail: 'API Gateway → Tracking appears twice',
        target: { type: 'edges', ids: ['e1', 'e2'] },
      });
      file.edges.push(edge('e3', 'a', 'b', 'gps stream'));
      expect(only(file).detail).toBe('API Gateway → Tracking appears 3 times');
    });

    it('treats an empty label like a missing one', () => {
      expect(
        kinds(
          deck({
            nodes: [node('a'), node('b')],
            edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b', ' ')],
          }),
        ),
      ).toEqual(['duplicate-connection']);
    });

    it('tells relationships apart by their column ends (042 FR-012)', () => {
      const fk = (id: string, column: string) => ({
        ...edge(id, 'a', 'b'),
        fromColumns: [column],
        toColumns: ['b-id'],
      });
      expect(
        kinds(deck({ nodes: [node('a'), node('b')], edges: [fk('e1', 'x'), fk('e2', 'y')] })),
      ).toEqual([]);
      expect(
        kinds(deck({ nodes: [node('a'), node('b')], edges: [fk('e1', 'x'), fk('e2', 'x')] })),
      ).toEqual(['duplicate-connection']);
    });

    it('ignores opposite directions, different labels and self-loops', () => {
      expect(
        kinds(
          deck({
            nodes: [node('a'), node('b')],
            edges: [
              edge('e1', 'a', 'b'),
              edge('e2', 'b', 'a'),
              edge('e3', 'a', 'b', 'other'),
              edge('e4', 'a', 'a'),
              edge('e5', 'a', 'a'),
            ],
          }),
        ),
      ).toEqual([]);
    });
  });

  describe('flows', () => {
    it('reports a step whose connection was deleted, and no broken chain after it', () => {
      const p = only(
        deck({
          ...chain(),
          flows: [
            {
              id: 'f',
              title: 'Proof of delivery',
              steps: [
                { id: 's1', edge: 'ab' },
                { id: 's2', edge: 'gone' },
                { id: 's3', edge: 'ab' },
              ],
            },
          ],
        }),
      );
      expect(p).toMatchObject({
        kind: 'step-without-connection',
        detail: 'Proof of delivery · step 2 used a deleted connection',
        target: { type: 'flow', flowId: 'f', stepId: 's2' },
        order: 2,
      });
    });

    it('reports a broken chain with the previous step number', () => {
      const p = only(
        deck({
          ...chain(),
          flows: [
            {
              id: 'f',
              title: 'Failed delivery',
              steps: [
                { id: 's1', edge: 'bc' },
                { id: 's2', edge: 'ab' },
              ],
            },
          ],
        }),
      );
      expect(p).toMatchObject({
        kind: 'broken-chain',
        title: 'Broken flow',
        detail: "Failed delivery · step 2 doesn't continue from step 1",
        target: { type: 'flow', flowId: 'f', stepId: 's2' },
      });
    });

    it('reports incomplete flows: no steps, empty branch fields, unknown branch', () => {
      expect(
        only(deck({ ...chain(), flows: [{ id: 'f', title: 'Refund', steps: [] }] })),
      ).toMatchObject({
        kind: 'incomplete-flow',
        detail: 'Refund has no steps',
      });
      const branched = deck({
        ...chain(),
        flows: [
          {
            id: 'f',
            title: 'Pay',
            branches: [
              { id: 'b1', label: 'ok', condition: 'paid' },
              { id: 'b2', label: ' ', condition: '' },
            ],
            steps: [
              { id: 's1', edge: 'ab' },
              { id: 's2', edge: 'bc', branch: 'b1' },
              { id: 's3', edge: 'bc', branch: 'b2' },
            ],
          },
        ],
      });
      expect(checkDeck(branched).list.map((p) => p.detail)).toEqual([
        'Pay · branch b has no condition',
        'Pay · branch b has no label',
      ]);
      const unknown = only(
        deck({
          ...chain(),
          flows: [{ id: 'f', title: 'Pay', steps: [{ id: 's1', edge: 'ab', branch: 'zz' }] }],
        }),
      );
      expect(unknown).toMatchObject({
        kind: 'incomplete-flow',
        detail: 'Pay · a step belongs to a branch that no longer exists',
      });
    });

    it('reports overlapping branch conditions once per group, not for empty ones', () => {
      const file = deck({
        ...chain(),
        flows: [
          {
            id: 'f',
            title: 'Place order',
            branches: [
              { id: 'b1', label: 'A', condition: 'Paid' },
              { id: 'b2', label: 'B', condition: 'unpaid' },
              { id: 'b3', label: 'C', condition: '  paid ' },
            ],
            steps: [{ id: 's1', edge: 'ab' }],
          },
        ],
      });
      expect(only(file)).toMatchObject({
        kind: 'overlapping-conditions',
        detail: 'Place order · branches a and c both say "paid"',
        target: { type: 'flow', flowId: 'f', branchIds: ['b1', 'b3'] },
      });
    });
  });

  describe('rules', () => {
    it('reports a missing rule on a component and on a step', () => {
      const file = deck({
        ...chain(),
        nodes: [node('a', { title: 'Order Service', rules: ['R'] }), node('b'), node('c')],
        flows: [{ id: 'f', title: 'Ship', steps: [{ id: 's1', edge: 'ab', rules: ['Q'] }] }],
      });
      expect(checkDeck(file).list.map((p) => [p.kind, p.detail])).toEqual([
        ['missing-rule', 'Order Service uses a rule that was deleted'],
        ['missing-rule', 'Ship · step 1 uses a rule that was deleted'],
      ]);
    });

    it('reports a rule without a catch-all row and a rule with invalid cells', () => {
      const file = deck({
        ...chain(),
        rules: {
          R: rule('Delivery tier', [{ id: 'r1', when: ['< 5'], then: ['x'] }]),
          S: rule('Sizes', [{ id: 'r1', when: ['< <'], then: ['x'] }, anyRow('r2')]),
        },
      });
      expect(checkDeck(file).list.map((p) => [p.kind, p.detail, p.target])).toEqual([
        ['invalid-rule-cells', "Sizes · 1 cell can't be read", { type: 'rule', ruleId: 'S' }],
        [
          'rule-without-catch-all',
          'Delivery tier · some inputs match no row',
          { type: 'rule', ruleId: 'R' },
        ],
      ]);
    });
  });

  describe('broken references', () => {
    it('reports a sticky anchor, a group parent and a parent cycle', () => {
      const file = deck({
        ...chain(),
        groups: [
          { id: 'g1', title: 'Core', parent: 'gone' },
          { id: 'g2', title: 'X', parent: 'g3' },
          { id: 'g3', title: 'Y', parent: 'g2' },
        ],
        stickies: [{ id: 'n1', text: '\nCheck SLA\nmore', anchor: 'missing' }],
      });
      expect(checkDeck(file).list.map((p) => p.detail)).toEqual([
        'Sticky "Check SLA" points to something that was deleted',
        'Group "Core" points to a group that was deleted',
        'Group "X" is inside itself',
      ]);
    });

    it('does not double-report step edges and branches', () => {
      const file = deck({
        ...chain(),
        flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'gone', branch: 'zz' }] }],
      });
      expect(kinds(file)).toEqual(['incomplete-flow']);
    });
  });

  describe('order, keys and index', () => {
    const messy = () =>
      deck({
        nodes: [node('a'), node('b'), node('z', { title: 'Zeta' }), node('y', { title: 'alpha' })],
        edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
        flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'gone' }] }],
        rules: { R: rule('R', []) },
      });

    it('sorts errors first, then by kind, then object title', () => {
      expect(checkDeck(messy()).list.map((p) => `${p.kind}/${p.objectTitle}`)).toEqual([
        'step-without-connection/F',
        'duplicate-connection/A',
        'rule-without-catch-all/R',
      ]);
    });

    it('keeps keys stable across calls and unrelated renames', () => {
      const before = checkDeck(messy()).list.map((p) => p.key);
      const renamed = messy();
      renamed.rules.R = rule('Renamed', []);
      expect(checkDeck(messy()).list.map((p) => p.key)).toEqual(before);
      expect(new Set(checkDeck(renamed).list.map((p) => p.key))).toEqual(new Set(before));
    });

    it('indexes problems by every object they name', () => {
      const result = checkDeck(messy());
      expect(result.total).toBe(result.list.length);
      expect(result.byObject.get('e1')?.map((p) => p.kind)).toEqual(['duplicate-connection']);
      expect(result.byObject.get('e2')?.map((p) => p.kind)).toEqual(['duplicate-connection']);
      expect(result.byObject.has('z')).toBe(false);
      expect(result.byObject.get('f')?.map((p) => p.kind)).toEqual(['step-without-connection']);
      expect(result.byObject.get('R')?.map((p) => p.kind)).toEqual(['rule-without-catch-all']);
      expect(result.byObject.has('a')).toBe(false);
    });

    it('never mutates its input', () => {
      const file = messy();
      const copy = structuredClone(file);
      checkDeck(file);
      expect(file).toEqual(copy);
    });
  });
});

describe('card type and pack problems (030)', () => {
  it('reports one problem per unknown type id, listing its cards', () => {
    const file = deck({
      nodes: [
        node('a', { type: 'robot' }),
        node('b', { type: 'robot' }),
        node('c', { type: 'drone' }),
        node('d', { type: 'warehouse' }),
      ],
    });
    const found = checkDeck(file).list.filter((p) => p.kind === 'unknown-card-type');
    expect(found).toHaveLength(2);
    const robot = found.find((p) => p.title === 'Unknown card type robot');
    expect(robot?.target).toEqual({ type: 'nodes', ids: ['a', 'b'] });
    expect(robot?.detail).toContain('A, B');
  });

  it('reports an unknown pack id', () => {
    const found = checkDeck(deck({ packs: ['architecture', 'future-pack'] })).list;
    expect(found.map((p) => [p.kind, p.title])).toEqual([
      ['unknown-pack', 'Unknown pack future-pack'],
    ]);
  });

  it('reports nothing for known ids', () => {
    const file = deck({
      packs: ['architecture', 'process', 'logistics', 'data'],
      nodes: [node('a', { type: 'task' }), node('b', { type: 'truck-route' })],
    });
    expect(kinds(file)).toEqual([]);
  });
});

describe('field-value-dangling (032 FR-017)', () => {
  const fields = [
    {
      id: 'f_zone',
      name: 'Zone',
      kind: 'select' as const,
      types: ['warehouse'],
      options: [{ id: 'z1', label: 'Cold' }],
    },
  ];
  const wh = (values: Record<string, unknown>, type = 'warehouse') =>
    deck({
      fields,
      nodes: [{ id: 'w', type, title: 'HCM', values } as SododeckFile['nodes'][number]],
    });

  it('reports nothing for valid values', () => {
    expect(kinds(wh({ f_zone: 'z1', 'warehouse.capacity': 82, 'warehouse.sla': 4 }))).toEqual([]);
  });

  it.each([
    [{ gone: 'x' }, 'gone', 'HCM holds a value for a field this deck no longer has (gone)'],
    [{ f_zone: 'z9' }, 'f_zone', 'Zone on HCM points at an option that no longer exists'],
    [
      { 'warehouse.capacity': 140 },
      'warehouse.capacity',
      'Capacity on HCM: Enter a number from 0 to 100.',
    ],
    [{ 'task.due': '14/10' }, 'task.due', 'Due date on HCM: Enter a date as YYYY-MM-DD.'],
  ])('reports %j with a Remove value fix', (values, fieldId, detail) => {
    const problem = only(wh(values));
    expect(problem.kind).toBe('field-value-dangling');
    expect(problem.title).toBe('Value without a field');
    expect(problem.detail).toBe(detail);
    expect(problem.target).toEqual({ type: 'node', id: 'w' });
    expect(problem.fixes).toEqual([
      { kind: 'remove-value', nodeId: 'w', fieldId, label: 'Remove value' },
    ]);
    expect(problem.key).toBe(`field-value-dangling:w:${fieldId}`);
  });

  it('reports a value of a field that no longer applies to the card type', () => {
    expect(only(wh({ f_zone: 'z1' }, 'service')).detail).toBe(
      'Zone no longer applies to Service cards (HCM)',
    );
  });

  it('reports one problem per card and field', () => {
    expect(kinds(wh({ gone: 1, f_zone: 'z9' }))).toEqual([
      'field-value-dangling',
      'field-value-dangling',
    ]);
  });
});

describe('database schema problems (040 FR-021)', () => {
  // The fixture links a bigint column to an enum to test the cascade (047: a type mismatch).
  const shop = structuredClone(shopDeck());
  const parent = shop.nodes.find((n) => n.id === 'categories')?.columns?.[1];
  if (parent !== undefined) delete parent.enumRef;
  const dbProblems = (file: SododeckFile) =>
    checkDeck(file).list.filter((p) => p.kind.startsWith('db-'));

  it('reports nothing for a consistent schema', () => {
    expect(dbProblems(shop)).toEqual([]);
  });

  it('reports an index part, a column end and an enumRef that name nothing', () => {
    const file = structuredClone(shop);
    const [, customers, orders] = file.nodes;
    const [relation] = file.edges;
    if (customers?.columns?.[2] === undefined || orders?.indexes?.[0] === undefined) {
      throw new Error('fixture changed');
    }
    customers.columns[2].enumRef = 'e-gone';
    orders.indexes[0].columns = ['o-gone'];
    if (relation !== undefined) relation.fromColumns = ['o-missing'];
    const problems = dbProblems(file);
    expect(problems.map((p) => [p.kind, p.title, p.target, p.detail])).toEqual([
      [
        'db-dangling-reference',
        'Missing enum',
        { type: 'node', id: 'customers' },
        'customers.status uses an enum this deck does not have (e-gone)',
      ],
      [
        'db-dangling-reference',
        'Missing column',
        { type: 'node', id: 'orders' },
        'orders · index ix-customer names a column the table does not have (o-gone)',
      ],
      [
        'db-dangling-reference',
        'Missing column',
        { type: 'edges', ids: ['r-orders-customer'] },
        'orders → customers · names a column orders does not have (o-missing)',
      ],
    ]);
    expect(
      checkDeck(file)
        .byObject.get('orders')
        ?.map((p) => p.key),
    ).toEqual([
      'db-dangling-reference:orders:ix-customer:o-gone',
      'db-dangling-reference:r-orders-customer:from:o-missing',
    ]);
    // Stable keys across recomputation.
    expect(dbProblems(file).map((p) => p.key)).toEqual(problems.map((p) => p.key));
  });

  it('reports composite ends of different lengths', () => {
    const file = structuredClone(shop);
    const composite = file.edges[1];
    if (composite !== undefined) composite.toColumns = ['i-order'];
    expect(dbProblems(file).map((p) => [p.kind, p.title, p.target, p.detail])).toEqual([
      [
        'db-composite-mismatch',
        "Key columns don't match",
        { type: 'edges', ids: ['r-ship-item'] },
        'shipments → order_items · 2 key columns on one end, 1 on the other',
      ],
    ]);
  });

  it('ignores column ends and table keys on cards that are not tables', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          columns: [{ id: 'c', name: 'c', type: 'int', enumRef: 'nope' }],
          indexes: [{ id: 'i', columns: ['gone'] }],
        },
        { id: 'b', type: 'service', title: 'B' },
      ],
      edges: [{ id: 'e', from: 'a', to: 'b', fromColumns: ['x', 'y'], toColumns: ['z'] }],
    };
    expect(dbProblems(file)).toEqual([]);
  });
});

describe('groups as connector ends (050)', () => {
  const groups = [
    { id: 'g', title: 'Payments' },
    { id: 'h', title: 'Ledger' },
  ];

  it('raises nothing for a deck with card → group, group → card and group → group edges', () => {
    expect(
      kinds(
        deck({
          nodes: [node('a')],
          groups,
          edges: [edge('a-g', 'a', 'g'), edge('h-a', 'h', 'a'), edge('g-h', 'g', 'h')],
        }),
      ),
    ).toEqual([]);
  });

  it('names a group end by its title in a duplicate connection', () => {
    const problem = only(
      deck({ nodes: [node('a')], groups, edges: [edge('e1', 'a', 'g'), edge('e2', 'a', 'g')] }),
    );
    expect(problem.kind).toBe('duplicate-connection');
    expect(problem.detail).toBe('A → Payments appears twice');
  });

  it('names a group end by its title on a connection with a broken end', () => {
    const problem = only(deck({ groups, edges: [edge('e', 'g', 'gone')] }));
    expect(problem.kind).toBe('broken-reference');
    expect(problem.detail).toBe('Connection Payments → gone points to a node that was deleted');
  });

  it('reports a node and a group sharing an id', () => {
    const problem = only(deck({ nodes: [node('g')], groups }));
    expect(problem.kind).toBe('broken-reference');
    expect(problem.target).toEqual({ type: 'object', ref: { scope: 'groups', id: 'g' } });
    expect(problem.detail).toBe('Group "Payments" has the same id as a card');
  });
});

describe('severity (047 R1)', () => {
  const ERRORS: readonly ProblemKind[] = [
    'broken-reference',
    'step-without-connection',
    'broken-chain',
    'invalid-rule-cells',
    'db-dangling-reference',
    'db-composite-mismatch',
    'db-duplicate-table',
    'db-duplicate-column',
    'db-duplicate-index',
    'db-duplicate-enum',
    'db-empty-column',
    'db-type-mismatch',
    'db-null-default',
  ];

  it('gives every kind the severity of contracts/lint-rules.md', () => {
    for (const kind of PROBLEM_KINDS) {
      expect(SEVERITY[kind], kind).toBe(ERRORS.includes(kind) ? 'error' : 'warning');
    }
    expect(Object.keys(SEVERITY).sort()).toEqual([...PROBLEM_KINDS].sort());
  });

  it('marks the missing-enum problem as an error', () => {
    const file = structuredClone(shopDeck());
    const customers = file.nodes.find((n) => n.id === 'customers');
    const column = customers?.columns?.[2];
    if (column === undefined) throw new Error('fixture changed');
    column.enumRef = 'e-gone';
    const problem = checkDeck(file).list.find((p) => p.title === 'Missing enum');
    expect(problem?.severity).toBe('error');
  });

  it('counts errors and warnings and lists errors first', () => {
    const file = deck({
      nodes: [node('a'), node('b'), node('c')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')],
      flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'gone' }] }],
      rules: { R: rule('R', []) },
    });
    const result = checkDeck(file);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(2);
    expect(result.errors + result.warnings).toBe(result.total);
    expect(result.list.map((p) => p.severity)).toEqual(['error', 'warning', 'warning']);
  });

  it('sorts within a severity by kind rank, object title, order, key', () => {
    const file = deck({
      nodes: [node('a'), node('b'), node('z', { title: 'Zeta' })],
      edges: [
        edge('e1', 'a', 'b'),
        edge('e2', 'a', 'b'),
        edge('e3', 'z', 'b'),
        edge('e4', 'z', 'b'),
      ],
    });
    const list = checkDeck(file).list;
    expect(list.map((p) => p.objectTitle)).toEqual(['A', 'Zeta']);
    expect(list.every((p) => p.severity === 'warning')).toBe(true);
  });
});

describe('schema lint rules (047)', () => {
  type Col = NonNullable<NodeData['columns']>[number];
  const col = (id: string, name: string, type: string, extra: Partial<Col> = {}): Col => ({
    id,
    name,
    type,
    ...extra,
  });
  const table = (id: string, title: string, columns: Col[], extra: Partial<NodeData> = {}) =>
    node(id, { type: 'db-table', title, columns, ...extra });
  const rel = (
    id: string,
    from: string,
    to: string,
    fromColumns: string[],
    toColumns: string[],
    extra: Partial<SododeckFile['edges'][number]> = {},
  ): SododeckFile['edges'][number] => ({ id, from, to, fromColumns, toColumns, ...extra });
  const pk = (prefix: string, type = 'int') => col(`${prefix}-id`, 'id', type, { pk: true });
  const db = (patch: Partial<SododeckFile>) => deck({ dialect: 'postgres', ...patch });
  const lint = (file: SododeckFile, kind?: ProblemKind) =>
    checkDeck(file).list.filter((p) => p.kind.startsWith('db-') && (kind ? p.kind === kind : true));
  const one = (file: SododeckFile, kind: ProblemKind): Problem => {
    const found = lint(file, kind);
    expect(found, kind).toHaveLength(1);
    const [first] = found;
    if (first === undefined) throw new Error('none');
    return first;
  };

  it('reports nothing on a consistent shop', () => {
    const shop = structuredClone(shopDeck());
    // The fixture links a bigint column to an enum to test the cascade; here it must be clean.
    const categories = shop.nodes.find((n) => n.id === 'categories');
    const parent = categories?.columns?.[1];
    if (parent !== undefined) delete parent.enumRef;
    expect(lint(shop)).toEqual([]);
  });

  describe('db-no-primary-key', () => {
    it('warns once per table with columns, offering make-pk when an id column exists', () => {
      const file = db({
        nodes: [
          table('t', 'audit_log', [col('c1', 'ID', 'int')]),
          table('u', 'events', [col('c2', 'at', 'timestamp')]),
          table('v', 'empty', []),
        ],
      });
      const [first, second] = lint(file, 'db-no-primary-key');
      expect(lint(file, 'db-no-primary-key')).toHaveLength(2);
      expect(first).toMatchObject({
        severity: 'warning',
        title: 'No primary key',
        detail: 'audit_log has no primary key',
        target: { type: 'node', id: 't' },
        column: { tableId: 't', columnId: 'c1' },
        fixes: [{ kind: 'make-pk', tableId: 't', columnId: 'c1', label: 'Make id the PK' }],
      });
      expect(second).toMatchObject({
        detail: 'events has no primary key',
        fixes: [{ kind: 'add-id-pk', tableId: 'u', type: 'uuid', label: 'Add id uuid PK' }],
      });
      expect(second?.column).toBeUndefined();
    });

    it('uses the dialect id type', () => {
      const file = deck({ dialect: 'mysql', nodes: [table('t', 'a', [col('c', 'x', 'int')])] });
      expect(one(file, 'db-no-primary-key').fixes?.[0]).toMatchObject({ type: 'char(36)' });
    });
  });

  describe('duplicates', () => {
    it('db-duplicate-table names both tables once per later table', () => {
      const file = db({
        nodes: [
          table('a', 'Orders', [pk('a')], { schema: 'public' }),
          table('b', 'orders ', [pk('b')], { schema: 'public' }),
          table('c', 'orders', [pk('c')], { schema: 'sales' }),
        ],
      });
      expect(one(file, 'db-duplicate-table')).toMatchObject({
        severity: 'error',
        title: 'Duplicate table',
        detail: 'Two tables named orders in public',
        target: { type: 'nodes', ids: ['a', 'b'] },
        fixes: [{ kind: 'rename', target: { type: 'table', tableId: 'b' } }],
      });
    });

    it('db-duplicate-column points at the second column', () => {
      const file = db({
        nodes: [
          table('p', 'products', [pk('p'), col('c1', 'sku', 'text'), col('c2', 'SKU', 'text')]),
        ],
      });
      expect(one(file, 'db-duplicate-column')).toMatchObject({
        severity: 'error',
        detail: 'products has two columns named SKU',
        target: { type: 'node', id: 'p' },
        column: { tableId: 'p', columnId: 'c2' },
        fixes: [{ kind: 'rename', target: { type: 'column', tableId: 'p', columnId: 'c2' } }],
      });
    });

    it('db-duplicate-index points at the second index', () => {
      const file = db({
        nodes: [
          table('o', 'orders', [pk('o')], {
            indexes: [
              { id: 'i1', name: 'orders_idx', columns: ['o-id'] },
              { id: 'i2', name: 'Orders_Idx', columns: ['o-id'] },
              { id: 'i3', columns: ['o-id'] },
              { id: 'i4', columns: ['o-id'] },
            ],
          }),
        ],
      });
      expect(one(file, 'db-duplicate-index')).toMatchObject({
        severity: 'error',
        detail: 'orders has two indexes named Orders_Idx',
        fixes: [{ kind: 'rename', target: { type: 'index', tableId: 'o', indexId: 'i2' } }],
      });
    });

    it('db-duplicate-enum covers two enums and a repeated value', () => {
      const v = (id: string, name: string) => ({ id, name });
      const file = db({
        enums: [
          {
            id: 'e1',
            name: 'status',
            schema: 'public',
            values: [v('v1', 'paid'), v('v2', 'paid')],
          },
          { id: 'e2', name: 'Status', schema: 'public', values: [v('v3', 'x')] },
        ],
      });
      const found = lint(file, 'db-duplicate-enum');
      expect(found.map((p) => p.detail)).toEqual([
        'status has the value paid twice',
        'Two enums named Status in public',
      ]);
      expect(found[1]).toMatchObject({
        severity: 'error',
        target: {
          type: 'object',
          ref: { scope: 'meta', id: '', child: { kind: 'enum', id: 'e2' } },
        },
        fixes: [{ kind: 'rename', target: { type: 'enum', enumId: 'e2' } }],
      });
      expect(found[0]?.fixes).toEqual([{ kind: 'add-values', enumId: 'e1', label: 'Add values' }]);
    });
  });

  describe('db-empty-column', () => {
    it('reports a column without a name or a type', () => {
      const file = db({
        nodes: [table('o', 'orders', [pk('o'), col('n', '', 'text'), col('t', 'notes', ' ')])],
      });
      const found = lint(file, 'db-empty-column');
      expect(found.map((p) => [p.title, p.severity])).toEqual([
        ['Column without a name', 'error'],
        ['Column without a type', 'error'],
      ]);
      expect(found[1]).toMatchObject({
        detail: 'orders.notes has no type',
        column: { tableId: 'o', columnId: 't' },
        fixes: [{ kind: 'pick-type', tableId: 'o', columnId: 't' }],
      });
      expect(found[0]?.fixes?.[0]).toMatchObject({ kind: 'rename' });
    });
  });

  describe('relationships', () => {
    const pair = (fromType: string, toType: string, edgeExtra = {}) =>
      db({
        nodes: [
          table('loyalty', 'loyalty_points', [pk('l'), col('ref', 'customer_ref', fromType)]),
          table('customers', 'customers', [pk('c', toType)]),
        ],
        edges: [rel('r', 'loyalty', 'customers', ['ref'], ['c-id'], edgeExtra)],
      });

    it('db-type-mismatch lists the types and offers the referenced type', () => {
      const problem = one(pair('int', 'uuid'), 'db-type-mismatch');
      expect(problem).toMatchObject({
        severity: 'error',
        title: 'Type mismatch',
        detail: 'loyalty_points.customer_ref is int, customers.id is uuid',
        target: { type: 'edges', ids: ['r'] },
        column: { tableId: 'loyalty', columnId: 'ref' },
        short: 'int → uuid',
        fixes: [
          {
            kind: 'match-type',
            tableId: 'loyalty',
            changes: [{ columnId: 'ref', type: 'uuid' }],
            label: 'Change type',
          },
        ],
      });
      expect(
        checkDeck(pair('int', 'uuid'))
          .byObject.get('loyalty')
          ?.map((p) => p.key),
      ).toContain(problem.key);
    });

    it('reads the referencing end from the cardinality (1-n keeps the key on the to side)', () => {
      const file = db({
        nodes: [
          table('o', 'orders', [pk('o', 'uuid')]),
          table('i', 'items', [pk('i'), col('oid', 'order_id', 'int')]),
        ],
        edges: [rel('r', 'o', 'i', ['o-id'], ['oid'], { cardinality: '1-n' })],
      });
      expect(one(file, 'db-type-mismatch')).toMatchObject({
        detail: 'items.order_id is int, orders.id is uuid',
        column: { tableId: 'i', columnId: 'oid' },
        fixes: [{ kind: 'match-type', tableId: 'i', changes: [{ columnId: 'oid', type: 'uuid' }] }],
      });
      expect(lint(file, 'db-fk-not-key')).toEqual([]);
    });

    it('does not treat int and integer or equal sizes as a mismatch', () => {
      expect(lint(pair('int', 'integer'), 'db-type-mismatch')).toEqual([]);
      expect(lint(pair('varchar(80)', 'varchar(100)'), 'db-type-mismatch')).toHaveLength(1);
    });

    it('changes every mismatched pair of a composite relationship', () => {
      const file = db({
        nodes: [
          table('a', 'a', [pk('a'), col('a1', 'x', 'int'), col('a2', 'y', 'text')]),
          table('b', 'b', [
            col('b1', 'x', 'bigint', { pk: true }),
            col('b2', 'y', 'text', { pk: true }),
          ]),
        ],
        edges: [rel('r', 'a', 'b', ['a1', 'a2'], ['b1', 'b2'])],
      });
      const fix = one(file, 'db-type-mismatch').fixes?.[0];
      expect(fix).toMatchObject({
        kind: 'match-type',
        changes: [{ columnId: 'a1', type: 'bigint' }],
      });
    });

    it('db-null-default flags NULL on a not-null column', () => {
      const file = db({
        nodes: [
          table('o', 'orders', [
            pk('o'),
            col('s', 'status', 'text', { notNull: true, defaultExpr: ' null ' }),
            col('t', 'tag', 'text', { defaultExpr: 'NULL' }),
          ]),
        ],
      });
      expect(one(file, 'db-null-default')).toMatchObject({
        severity: 'error',
        detail: 'orders.status is not null with default NULL',
        column: { tableId: 'o', columnId: 's' },
        fixes: [
          { kind: 'remove-default', tableId: 'o', columnId: 's', label: 'Remove default' },
          { kind: 'allow-null', tableId: 'o', columnId: 's', label: 'Allow null' },
        ],
      });
    });

    it('db-fk-not-key warns when the referenced columns are not a key', () => {
      const file = db({
        nodes: [
          table('rv', 'reviews', [pk('rv'), col('ref', 'order_ref', 'int')]),
          table('o', 'orders', [pk('o'), col('n', 'number', 'int')]),
        ],
        edges: [rel('r', 'rv', 'o', ['ref'], ['n'])],
      });
      expect(one(file, 'db-fk-not-key')).toMatchObject({
        severity: 'warning',
        detail: 'reviews.order_ref → orders.number: not a primary key or unique',
        short: 'not key',
        column: { tableId: 'rv', columnId: 'ref' },
        fixes: [{ kind: 'pick-column', edgeId: 'r', label: 'Pick column' }],
      });
      const unique = structuredClone(file);
      const number = unique.nodes[1]?.columns?.[1];
      if (number !== undefined) number.unique = true;
      expect(lint(unique, 'db-fk-not-key')).toEqual([]);
      const indexed = structuredClone(file);
      const orders = indexed.nodes[1];
      if (orders !== undefined) orders.indexes = [{ id: 'u', unique: true, columns: ['n'] }];
      expect(lint(indexed, 'db-fk-not-key')).toEqual([]);
    });

    it('db-many-to-many offers a junction table', () => {
      const file = db({
        nodes: [table('p', 'products', [pk('p')]), table('c', 'categories', [pk('c')])],
        edges: [{ id: 'nn', from: 'p', to: 'c', cardinality: 'n-n' }],
      });
      expect(one(file, 'db-many-to-many')).toMatchObject({
        severity: 'warning',
        detail: 'n–n between products and categories: create a junction table?',
        target: { type: 'edges', ids: ['nn'] },
        short: 'n–n',
        fixes: [{ kind: 'create-junction', edgeId: 'nn', label: 'Create junction table' }],
      });
    });

    it('db-required-loop finds loops of not-null references and ignores nullable ones', () => {
      const tables = (nullable: boolean) => [
        table('o', 'orders', [pk('o'), col('op', 'payment_id', 'int', { notNull: !nullable })]),
        table('p', 'payments', [pk('p'), col('po', 'order_id', 'int', { notNull: true })]),
      ];
      const edges = [rel('r1', 'o', 'p', ['op'], ['p-id']), rel('r2', 'p', 'o', ['po'], ['o-id'])];
      const problem = one(db({ nodes: tables(false), edges }), 'db-required-loop');
      expect(problem).toMatchObject({
        severity: 'warning',
        detail: 'orders → payments → orders: every reference is not null',
        target: { type: 'edges', ids: ['r1', 'r2'] },
        short: 'loop',
      });
      expect(problem.key).toBe('db-required-loop:o:p');
      expect(lint(db({ nodes: tables(true), edges }), 'db-required-loop')).toEqual([]);
    });

    it('treats a self-reference as a loop only when the column is not null', () => {
      const file = (notNull: boolean) =>
        db({
          nodes: [table('c', 'categories', [pk('c'), col('pa', 'parent_id', 'int', { notNull })])],
          edges: [rel('r', 'c', 'c', ['pa'], ['c-id'])],
        });
      expect(lint(file(true), 'db-required-loop')).toHaveLength(1);
      expect(lint(file(false), 'db-required-loop')).toEqual([]);
    });

    it('db-duplicate-relationship keeps the first and no duplicate-connection', () => {
      const file = db({
        nodes: [
          table('rv', 'reviews', [pk('rv'), col('oi', 'order_id', 'int')]),
          table('o', 'orders', [pk('o')]),
        ],
        edges: [rel('r1', 'rv', 'o', ['oi'], ['o-id']), rel('r2', 'rv', 'o', ['oi'], ['o-id'])],
      });
      expect(one(file, 'db-duplicate-relationship')).toMatchObject({
        severity: 'warning',
        detail: 'reviews.order_id → orders.id appears twice',
        target: { type: 'edges', ids: ['r2'] },
        column: { tableId: 'rv', columnId: 'oi' },
        fixes: [{ kind: 'delete-edge', edgeId: 'r2', label: 'Delete duplicate' }],
      });
      expect(kinds(file)).not.toContain('duplicate-connection');
    });

    it('gives no follow-on problems to a dangling or unequal-length relationship', () => {
      const tables = [
        table('a', 'a', [pk('a'), col('a1', 'x', 'int'), col('a2', 'y', 'int', { notNull: true })]),
        table('b', 'b', [pk('b', 'uuid'), col('b1', 'z', 'uuid')]),
      ];
      const dangling = db({
        nodes: tables,
        edges: [rel('r1', 'a', 'b', ['a1'], ['gone']), rel('r2', 'a', 'b', ['a1'], ['gone'])],
      });
      expect(lint(dangling).map((p) => p.kind)).toEqual([
        'db-dangling-reference',
        'db-dangling-reference',
      ]);
      const unequal = db({
        nodes: tables,
        edges: [
          rel('r1', 'a', 'b', ['a1', 'a2'], ['b-id']),
          rel('r2', 'a', 'b', ['a1', 'a2'], ['b-id']),
        ],
      });
      expect(lint(unequal).map((p) => p.kind)).toEqual([
        'db-composite-mismatch',
        'db-composite-mismatch',
      ]);
    });
  });

  describe('enums and defaults', () => {
    it('db-empty-enum warns about an enum without values', () => {
      const file = db({ enums: [{ id: 'e', name: 'shipment_status', values: [] }] });
      expect(one(file, 'db-empty-enum')).toMatchObject({
        severity: 'warning',
        detail: 'Enum shipment_status has no values',
        fixes: [{ kind: 'add-values', enumId: 'e', label: 'Add values' }],
      });
    });

    it('db-default-type checks numbers, booleans and enum values only', () => {
      const file = db({
        enums: [{ id: 'e', name: 'st', values: [{ id: 'v', name: 'open' }] }],
        nodes: [
          table('o', 'orders', [
            pk('o'),
            col('q', 'qty', 'integer', { default: 'many' }),
            col('q2', 'qty2', 'integer', { default: '12' }),
            col('b', 'flag', 'boolean', { default: 'maybe' }),
            col('b2', 'flag2', 'boolean', { default: true }),
            col('s', 'state', 'st', { enumRef: 'e', default: 'closed' }),
            col('s2', 'state2', 'st', { enumRef: 'e', default: 'open' }),
            col('t', 'note', 'text', { default: 5 }),
            col('x', 'expr', 'integer', { defaultExpr: "'many'" }),
          ]),
        ],
      });
      const found = lint(file, 'db-default-type');
      expect(found.map((p) => p.detail)).toEqual([
        "orders.flag is boolean with default 'maybe'",
        "orders.qty is integer with default 'many'",
        "orders.state is st with default 'closed'",
      ]);
      expect(found[1]).toMatchObject({
        severity: 'warning',
        title: 'Default does not fit the type',
        column: { tableId: 'o', columnId: 'q' },
        fixes: [{ kind: 'remove-default', tableId: 'o', columnId: 'q' }],
      });
    });

    it('db-unknown-type groups columns by type name', () => {
      const file = deck({
        dialect: 'mysql',
        nodes: [
          table('a', 'a', [pk('a'), col('a1', 'x', 'citext'), col('a2', 'y', 'CITEXT')]),
          table('b', 'b', [col('b0', 'k', 'int', { pk: true }), col('b1', 'z', 'citext')]),
        ],
      });
      const problem = one(file, 'db-unknown-type');
      expect(problem).toMatchObject({
        severity: 'warning',
        title: 'Type not in the MySQL list',
        detail: 'citext is not a MySQL type · 3 columns',
        target: { type: 'nodes', ids: ['a', 'b'] },
        column: { tableId: 'a', columnId: 'a1' },
        fixes: [{ kind: 'pick-type', tableId: 'a', columnId: 'a1' }],
      });
      expect(problem.key).toBe('db-unknown-type:citext');
    });
  });

  it('qualifies names with the schema only when the deck has several', () => {
    const one1 = db({ nodes: [table('a', 'a', [col('c', 'x', 'int')], { schema: 'sales' })] });
    expect(lint(one1)[0]?.detail).toBe('a has no primary key');
    const two = db({
      nodes: [
        table('a', 'a', [col('c', 'x', 'int')], { schema: 'sales' }),
        table('b', 'b', [pk('b')], { schema: 'public' }),
      ],
    });
    expect(lint(two)[0]?.detail).toBe('sales.a has no primary key');
  });

  it('stays within each object kind: other cards never get db rules', () => {
    const file = db({
      nodes: [node('svc', { columns: [col('c', '', '')] }), table('t', 't', [pk('t')])],
    });
    expect(lint(file)).toEqual([]);
  });
});
