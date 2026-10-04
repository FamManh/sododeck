import { readFile } from 'node:fs/promises';

import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createDeck, createEditor, fromJSON, serializeDeck, toJSON } from '../src';
import { largeDeck, readExample, shopDeck } from './helpers';

const minimal = await readExample('minimal.sododeck.json');
const flowAndRule = await readExample('flow-and-rule.sododeck.json');
/** Uses every object type and every field of format v1. */
const full = await readExample('full.sododeck.json');

const empty = emptySododeckFile();
const { $schema, version, ...collections } = empty;

/** One case per object type, each with every optional field (US2 AS1, FR-023). */
const perType: [string, SododeckFile][] = [
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
        { id: 's1', text: 'Anchored', color: 'blue', anchor: 'a' },
        { id: 's2', text: 'Free', color: 'grey', position: { x: 1, y: 1 } },
        { id: 's3', text: '', anchor: 'a', position: { x: 0, y: -8 } },
        { id: 's4', text: 'Collapsed', position: { x: 2, y: 2 }, collapsed: true },
        { id: 's5', text: 'Not collapsed', position: { x: 3, y: 3 }, collapsed: false },
        { id: 's6', text: 'Stays visible', position: { x: 4, y: 4 }, showInFlows: true },
        { id: 's7', text: 'Dims normally', position: { x: 5, y: 5 }, showInFlows: false },
        {
          id: 's8',
          text: 'Anchored, collapsed, stays visible',
          anchor: 'a',
          position: { x: 6, y: 6 },
          collapsed: true,
          showInFlows: true,
        },
      ],
    },
  ],
];

/** Explicitly empty values and orders the layout must keep (036 data-model "Round-trip cases"). */
const layoutEdgeCases: [string, SododeckFile][] = [
  [
    'explicitly empty long text (036)',
    {
      $schema,
      version,
      description: '',
      ...collections,
      nodes: [{ id: 'n', type: 'service', title: 'N', description: '' }],
      edges: [{ id: 'e', from: 'n', to: 'n', description: '' }],
      flows: [
        {
          id: 'f',
          title: 'F',
          description: '',
          steps: [{ id: 's', edge: 'e', description: '', payload: '', notes: '' }],
        },
      ],
      rules: {
        R: { title: 'R', description: '', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
      },
      stickies: [{ id: 'k', text: '', position: { x: 0, y: 0 } }],
    },
  ],
  [
    'flow steps out of normal order (036)',
    {
      ...empty,
      nodes: [{ id: 'n', type: 'service', title: 'N' }],
      edges: [{ id: 'e', from: 'n', to: 'n' }],
      flows: [
        {
          id: 'f',
          title: 'F',
          branches: [
            { id: 'a', label: 'A', condition: '' },
            { id: 'b', label: 'B', condition: 'x', description: 'Second' },
          ],
          steps: [
            { id: 's1', edge: 'e' },
            { id: 'b1', edge: 'e', branch: 'a' },
            { id: 's2', edge: 'e' },
            { id: 'b2', edge: 'e', branch: 'b' },
            { id: 'b3', edge: 'e', branch: 'a' },
          ],
        },
      ],
    },
  ],
  [
    'rule rows with empty cells (036)',
    {
      ...empty,
      rules: {
        Z: { title: 'Z', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
        A: {
          title: 'A',
          hitPolicy: 'unique',
          inputs: [
            { id: 'i1', label: 'One' },
            { id: 'i2', label: 'Two' },
          ],
          outputs: [{ id: 'o1', label: 'Out' }],
          rows: [
            { id: 'r1', when: ['', 'x'], then: [''] },
            { id: 'r2', when: ['', ''], then: ['y'] },
          ],
        },
      },
    },
  ],
];

const cases: [string, SododeckFile][] = [
  ['empty deck', empty],
  ['minimal example', minimal],
  ['flow-and-rule example', flowAndRule],
  ['full example', full],
  ...perType,
  ...layoutEdgeCases,
];

describe('round-trip (US2 AS1, FR-022/023)', () => {
  it('writes tagColors right after swatches, sorted by tag key, and drops an empty map (033)', () => {
    const colored = toJSON(
      fromJSON({
        ...empty,
        swatches: ['#7a3cff'],
        tagColors: { b: 'red', A: 'blue' },
        nodes: [{ id: 'n', type: 'client', title: 'N' }],
      }),
    );
    const keys = Object.keys(colored);
    expect(keys.indexOf('tagColors')).toBe(keys.indexOf('swatches') + 1);
    expect(Object.keys(colored.tagColors ?? {})).toEqual(['A', 'b']);
    expect(toJSON(fromJSON({ ...empty, tagColors: {} }))).not.toHaveProperty('tagColors');
    expect(toJSON(fromJSON(empty))).not.toHaveProperty('tagColors');
  });

  it('createDeck() produces an empty valid file', () => {
    expect(toJSON(createDeck())).toEqual({
      ...emptySododeckFile(),
      packs: ['architecture', 'process', 'data', 'database', 'shapes'],
    });
  });

  it.each(cases)('round-trips the %s losslessly', (_name, file) => {
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    expect(serializeDeck(out)).toBe(serializeDeck(file));
    expect(serializeDeck(out)).toBe(`${JSON.stringify(file, null, 2)}\n`);
  });

  it.each([
    ['generated 500-node deck', largeDeck()],
    [
      'generated 2,000-node deck',
      largeDeck({ nodes: 2000, edges: 4000, flows: 40, stepsPerFlow: 10, rules: 20, stickies: 50 }),
    ],
  ] as const)('serializes the %s byte-identically (SC-001)', (_name, file) => {
    expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
  });

  it.each(cases)(
    'serializes a replica of the %s identically (persistence / sync)',
    (_name, file) => {
      const replica = new Y.Doc();
      Y.applyUpdate(replica, Y.encodeStateAsUpdate(fromJSON(file)));
      expect(toJSON(replica)).toEqual(file);
      expect(serializeDeck(toJSON(replica))).toBe(serializeDeck(file));
    },
  );
});

/** Map-like objects keep their own key order; every other object is reversed. */
const MAP_PATHS = [
  /^rules$/,
  /^tagColors$/,
  /^views\.\d+\.positions$/,
  /^views\.\d+\.groupFrames$/,
  /^flows\.\d+\.steps\.\d+\.ruleInputs(\.[^.]+)?$/,
];

function shuffleKeys(value: unknown, path = ''): unknown {
  if (Array.isArray(value))
    return value.map((v, i) => shuffleKeys(v, path === '' ? String(i) : `${path}.${String(i)}`));
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value).map(
    ([k, v]) => [k, shuffleKeys(v, path === '' ? k : `${path}.${k}`)] as const,
  );
  const isMap = MAP_PATHS.some((re) => re.test(path));
  return Object.fromEntries(isMap ? entries : entries.reverse());
}

describe('rule links made through the editor (008)', () => {
  it('round-trips attachments and sample inputs written by attachRule and setRuleInputs', () => {
    const doc = fromJSON({
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      edges: [{ id: 'e', from: 'a', to: 'a' }],
      flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'e' }] }],
      rules: {
        R: {
          title: 'R',
          hitPolicy: 'first',
          inputs: [{ id: 'c', label: 'C' }],
          outputs: [],
          rows: [],
        },
      },
    });
    const editor = createEditor(doc);
    editor.attachRule({ kind: 'node', id: 'a' }, 'R');
    editor.attachRule({ kind: 'step', flowId: 'f', stepId: 's' }, 'R');
    editor.setRuleInputs('f', 's', 'R', { c: '5' });
    const file = toJSON(doc);
    expect(file.nodes[0]?.rules).toEqual(['R']);
    expect(file.flows[0]?.steps[0]).toEqual({
      id: 's',
      edge: 'e',
      rules: ['R'],
      ruleInputs: { R: { c: '5' } },
    });
    expect(toJSON(fromJSON(file))).toEqual(file);
    expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
  });
});

describe('step touches and table owners (049)', () => {
  const file: SododeckFile = {
    ...empty,
    nodes: [
      { id: 'svc', type: 'service', title: 'Orders' },
      { id: 'db', type: 'database', title: 'Orders DB' },
      { id: 'db2', type: 'database', title: 'Customers DB' },
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        parent: 'db',
        columns: [{ id: 'o-id', name: 'id', type: 'bigint', pk: true }],
      },
      {
        id: 'customers',
        type: 'db-table',
        title: 'customers',
        parent: 'db2',
        columns: [{ id: 'c-email', name: 'email', type: 'text' }],
      },
      { id: 'loose', type: 'db-table', title: 'loose', columns: [] },
    ],
    edges: [{ id: 'e', from: 'svc', to: 'db' }],
    flows: [
      {
        id: 'fl',
        title: 'Checkout',
        steps: [
          {
            id: 's1',
            edge: 'e',
            title: 'Create order',
            touches: [
              { table: 'orders', access: 'write' },
              { table: 'orders', column: 'o-id', access: 'read' },
              { table: 'customers', column: 'c-email', access: 'read' },
              { table: 'loose', access: 'write' },
            ],
          },
          { id: 's2', edge: 'e', touches: [] },
        ],
      },
    ],
  };

  it('round-trips touches (table and column, read and write) and owners losslessly', () => {
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    expect(serializeDeck(out)).toBe(`${JSON.stringify(file, null, 2)}\n`);
  });

  it('writes touches made through the editor last in the step, keys in schema order', () => {
    const doc = fromJSON({
      ...file,
      flows: [{ id: 'fl', title: 'F', steps: [{ id: 's', edge: 'e' }] }],
    });
    const editor = createEditor(doc);
    editor.addTouch('fl', 's', { access: 'read', column: 'o-id', table: 'orders' } as never);
    editor.updateStep('fl', 's', { title: 'Read order' });
    const step = toJSON(doc).flows[0]?.steps[0];
    expect(Object.keys(step ?? {})).toEqual(['id', 'edge', 'title', 'touches']);
    expect(Object.keys(step?.touches?.[0] ?? {})).toEqual(['table', 'column', 'access']);
    expect(toJSON(fromJSON(toJSON(doc)))).toEqual(toJSON(doc));
  });
});

describe('canonical key order (FR-022, research R2)', () => {
  it('writes every object in schema order whatever the input order', () => {
    const shuffled = shuffleKeys(full) as SododeckFile;
    expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(full));

    const out = toJSON(fromJSON(shuffled));
    expect(out).toEqual(full);
    expect(JSON.stringify(out)).toBe(JSON.stringify(full));
    expect(serializeDeck(shuffled)).toBe(serializeDeck(full));
  });

  it('writes objects added through the editor in schema order', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    editor.add('stickies', { position: { y: 2, x: 1 }, color: 'green', text: 'Hi' });
    const [sticky] = toJSON(doc).stickies;
    expect(Object.keys(sticky ?? {})).toEqual(['id', 'text', 'color', 'position']);
    expect(Object.keys(sticky?.position ?? {})).toEqual(['x', 'y']);
  });

  it('writes collapsed and showInFlows after position (ADR 0010)', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    const id = editor.add('stickies', {
      text: 'Hi',
      position: { x: 1, y: 2 },
      showInFlows: true,
      collapsed: true,
    });
    const [sticky] = toJSON(doc).stickies;
    expect(sticky?.id).toBe(id);
    expect(Object.keys(sticky ?? {})).toEqual([
      'id',
      'text',
      'position',
      'collapsed',
      'showInFlows',
    ]);
  });
});

describe('group frames (016)', () => {
  it('writes a group frame after parent, and a view frame after positions', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    editor.add('groups', { id: 'p', title: 'P' });
    editor.add('groups', {
      size: { height: 96, width: 160 },
      position: { y: 2, x: 1 },
      parent: 'p',
      title: 'G',
      id: 'g',
    });
    const group = toJSON(doc).groups[1];
    expect(Object.keys(group ?? {})).toEqual(['id', 'title', 'parent', 'position', 'size']);
    expect(Object.keys(group?.size ?? {})).toEqual(['width', 'height']);
    const text = serializeDeck(toJSON(doc));
    expect(serializeDeck(toJSON(fromJSON(toJSON(doc))))).toBe(text);
  });
});

describe('card size and connector route (017)', () => {
  it('round-trips a node with and without size', () => {
    const withSize: SododeckFile = {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A', size: { width: 244, height: 80 } }],
    };
    const withoutSize: SododeckFile = {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
    };
    for (const file of [withSize, withoutSize]) {
      expect(toJSON(fromJSON(file))).toEqual(file);
    }
    expect(toJSON(fromJSON(withoutSize)).nodes[0]).not.toHaveProperty('size');
  });

  it('round-trips an edge route of sides only, offset only, all three, and a hand-written {}', () => {
    const base: Omit<SododeckFile, 'edges'> = {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
    };
    const routes = [
      { fromSide: 'top', toSide: 'bottom' },
      { offset: 24 },
      { fromSide: 'left', toSide: 'right', offset: -8 },
      {},
    ] as const;
    for (const route of routes) {
      const file: SododeckFile = {
        ...base,
        edges: [{ id: 'e', from: 'a', to: 'a', route }],
      };
      expect(toJSON(fromJSON(file))).toEqual(file);
    }
  });

  it('writes size after position and route after links', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    editor.add('nodes', { id: 'a', type: 'client', title: 'A', position: { x: 1, y: 2 } });
    editor.setCardSize('a', { width: 200, height: 72 });
    editor.add('edges', { id: 'e', from: 'a', to: 'a', links: [{ url: 'https://example.com' }] });
    editor.setEdgeRoute('e', { fromSide: 'top', toSide: 'bottom' });
    const [node] = toJSON(doc).nodes;
    const [edge] = toJSON(doc).edges;
    expect(Object.keys(node ?? {})).toEqual(['id', 'type', 'title', 'position', 'size']);
    expect(Object.keys(edge ?? {})).toEqual(['id', 'from', 'to', 'links', 'route']);
  });

  it('keeps size and route absent after an edit to another field', () => {
    const doc = fromJSON({
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      edges: [{ id: 'e', from: 'a', to: 'a' }],
    });
    const editor = createEditor(doc);
    editor.update('nodes', 'a', { title: 'Renamed' });
    editor.update('edges', 'e', { label: 'Call' });
    const [node] = toJSON(doc).nodes;
    const [edge] = toJSON(doc).edges;
    expect(node).not.toHaveProperty('size');
    expect(edge).not.toHaveProperty('route');
  });
});

describe('connector line type (029)', () => {
  it('round-trips each shape, curved with an offset, and no style staying absent', () => {
    const edges: SododeckFile['edges'] = [
      { id: 'e1', from: 'a', to: 'a', style: { shape: 'curved' } },
      { id: 'e2', from: 'a', to: 'a', style: { shape: 'elbow' } },
      { id: 'e3', from: 'a', to: 'a', style: { shape: 'straight' } },
      { id: 'e4', from: 'a', to: 'a', route: { offset: 12 }, style: { shape: 'curved' } },
      { id: 'e5', from: 'a', to: 'a' },
    ];
    const file: SododeckFile = {
      ...empty,
      nodes: [{ id: 'a', type: 'client', title: 'A' }],
      edges,
    };
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    expect(out.edges[4]).not.toHaveProperty('style');
    expect(Object.keys(out.edges[3] ?? {})).toEqual(['id', 'from', 'to', 'route', 'style']);
  });
});

describe('rename safety for flows, features and branches (006, constitution III)', () => {
  const file: SododeckFile = {
    ...empty,
    nodes: [{ id: 'a', type: 'client', title: 'A' }],
    edges: [{ id: 'aa', from: 'a', to: 'a' }],
    features: [{ id: 'feat', title: 'Delivery' }],
    flows: [
      {
        id: 'f',
        title: 'Pay',
        feature: 'feat',
        branches: [{ id: 'ok', label: 'ok', condition: 'c' }],
        steps: [
          { id: 's1', edge: 'aa' },
          { id: 's2', edge: 'aa', branch: 'ok' },
        ],
      },
    ],
  };

  it('keeps every id and step.branch when a branch, flow or feature is renamed', () => {
    const doc = fromJSON(file);
    const editor = createEditor(doc);
    editor.updateBranch('f', 'ok', { label: 'payment ok' });
    editor.update('flows', 'f', { title: 'Pay for order' });
    editor.update('features', 'feat', { title: 'Delivery & tracking' });

    const expected = structuredClone(file);
    const [flow] = expected.flows;
    const [feature] = expected.features;
    if (flow?.branches?.[0] === undefined || feature === undefined) throw new Error('fixture');
    flow.branches[0].label = 'payment ok';
    flow.title = 'Pay for order';
    feature.title = 'Delivery & tracking';
    expect(toJSON(doc)).toEqual(expected);
  });
});

describe('edits change only what they touch (US2 AS2)', () => {
  it('renaming one node changes only its title', () => {
    const doc = fromJSON(flowAndRule);
    const [first] = flowAndRule.nodes;
    if (first === undefined) throw new Error('example has nodes');
    createEditor(doc).update('nodes', first.id, { title: 'Renamed' });

    const expected = structuredClone(flowAndRule);
    const node = expected.nodes[0];
    if (node !== undefined) node.title = 'Renamed';
    expect(serializeDeck(toJSON(doc))).toBe(serializeDeck(expected));
  });
});

describe('connector style, anchors, bends and label position (022)', () => {
  const nodes: SododeckFile['nodes'] = [{ id: 'a', type: 'client', title: 'A' }];

  it('round-trips every new key', () => {
    const file: SododeckFile = {
      ...empty,
      nodes,
      edges: [
        {
          id: 'e1',
          from: 'a',
          to: 'a',
          label: 'call',
          labelAt: 0.2,
          route: {
            fromSide: 'right',
            toSide: 'left',
            fromAt: 0.25,
            toAt: 1,
            waypoints: [
              { x: 0.5, dy: -88 },
              { dx: 4, y: 1 },
            ],
          },
          style: { shape: 'elbow', dash: 'dashed', width: 3, color: 'blue', animated: true },
        },
        { id: 'e2', from: 'a', to: 'a', style: { dash: 'dotted', width: 1.5, color: '#7a3cff' } },
      ],
    };
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    expect(serializeDeck(out)).toBe(serializeDeck(file));
  });

  it('keeps a 017 offset route unchanged on load and save', () => {
    const file: SododeckFile = {
      ...empty,
      nodes,
      edges: [
        { id: 'e', from: 'a', to: 'a', route: { fromSide: 'right', toSide: 'left', offset: 40 } },
      ],
    };
    expect(toJSON(fromJSON(file))).toEqual(file);
  });

  it('adds no 022 key after an unrelated edit of a pre-022 file', () => {
    const file: SododeckFile = {
      ...empty,
      nodes,
      edges: [{ id: 'e', from: 'a', to: 'a', style: { shape: 'straight' } }],
    };
    const doc = fromJSON(file);
    const editor = createEditor(doc);
    editor.update('edges', 'e', { label: 'Call' });
    editor.update('nodes', 'a', { title: 'Renamed' });
    expect(toJSON(doc).edges[0]).toEqual({
      id: 'e',
      from: 'a',
      to: 'a',
      label: 'Call',
      style: { shape: 'straight' },
    });
  });

  it('orders style keys shape, dash, width, color, animated and route keys by the schema', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    editor.add('nodes', { id: 'a', type: 'client', title: 'A' });
    editor.add('edges', { id: 'e', from: 'a', to: 'a' });
    editor.setEdgeStyle(['e'], { animated: true, color: 'red', width: 3, dash: 'dashed' });
    editor.setEdgeStyle(['e'], { shape: 'straight' });
    editor.setEdgeRoute('e', {
      waypoints: [{ x: 0.5, y: 0.5 }],
      toAt: 0.2,
      toSide: 'top',
      fromAt: 0.1,
      fromSide: 'left',
    });
    const [edge] = toJSON(doc).edges;
    expect(Object.keys(edge?.style ?? {})).toEqual(['shape', 'dash', 'width', 'color', 'animated']);
    expect(Object.keys(edge?.route ?? {})).toEqual([
      'fromSide',
      'toSide',
      'fromAt',
      'toAt',
      'waypoints',
    ]);
  });
});

describe('typed fields (032)', () => {
  const withFields: SododeckFile = {
    ...empty,
    fields: [
      { id: 'warehouse.capacity', name: 'Capacity', kind: 'progress', types: ['warehouse'] },
      {
        id: 'f_zone',
        name: 'Zone',
        kind: 'status',
        types: ['warehouse'],
        onCard: true,
        options: [
          { id: 'z1', label: 'Cold', color: 'cyan', icon: 'circle-dot' },
          { id: 'z2', label: 'Dry' },
        ],
      },
      { id: 'f_none', name: 'Empty select', kind: 'select', options: [] },
      { id: 'owner', name: 'Owner', kind: 'person', onCard: true },
    ],
    fieldDefaults: ['warehouse', 'robot'],
    nodes: [
      {
        id: 'w',
        type: 'warehouse',
        title: 'HCM',
        owner: 'Lan',
        values: {
          a_text: 'x',
          b_num: 3.5,
          c_range: { from: '2026-10-06', to: '2026-10-17' },
          d_link: { url: 'https://x.io', label: 'X' },
          e_link: { url: 'mailto:a@x.io' },
          f_zone: 'z1',
          gone: 'dangling',
          'warehouse.capacity': 140,
        },
      },
    ],
  };

  it('round-trips materialised types, every value shape and dangling values unchanged', () => {
    const out = toJSON(fromJSON(withFields));
    expect(out).toEqual(withFields);
    expect(serializeDeck(out)).toBe(serializeDeck(withFields));
  });

  it('writes a deck saved before 032 byte-identical, with no field data', () => {
    for (const file of [minimal, flowAndRule]) {
      expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
    }
    const out = toJSON(fromJSON(minimal));
    expect(out.fields).toBeUndefined();
    expect(out.fieldDefaults).toBeUndefined();
  });

  it('stores only values when no definition changed', () => {
    const doc = fromJSON({
      ...empty,
      nodes: [{ id: 't', type: 'task', title: 'T' }],
    });
    createEditor(doc).setValues(['t'], 'task.status', 'doing');
    const out = toJSON(doc);
    expect(out.fields).toBeUndefined();
    expect(out.nodes[0]?.values).toEqual({ 'task.status': 'doing' });
    expect(toJSON(fromJSON(out))).toEqual(out);
  });

  it('writes values sorted by field id and value keys in schema order', () => {
    const shuffled = structuredClone(withFields);
    const node = shuffled.nodes[0];
    if (node?.values === undefined) throw new Error('missing values');
    node.values = Object.fromEntries(Object.entries(node.values).reverse());
    node.values.d_link = { label: 'X', url: 'https://x.io' };
    expect(serializeDeck(shuffled)).toBe(serializeDeck(withFields));
    expect(serializeDeck(toJSON(fromJSON(shuffled)))).toBe(serializeDeck(withFields));
  });
});

describe('shapes and forms (031)', () => {
  it('opens and saves a deck from before 031 byte for byte, packs included', async () => {
    const before = await readExample('minimal.sododeck.json');
    const legacy: SododeckFile = {
      ...before,
      packs: ['architecture', 'process', 'logistics', 'data'],
    };
    const text = serializeDeck(legacy);
    expect(serializeDeck(toJSON(fromJSON(JSON.parse(text) as SododeckFile)))).toBe(text);
  });

  it('round-trips every shape type and both forms, display right after type', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      packs: ['architecture', 'process', 'logistics', 'data', 'shapes'],
      nodes: [
        ...[
          'rectangle',
          'rounded-rectangle',
          'ellipse',
          'diamond',
          'pill',
          'cylinder',
          'document-shape',
          'parallelogram',
          'hexagon',
          'actor',
          'text',
        ].map((type, i) => ({ id: `s${String(i)}`, type, title: type })),
        {
          id: 'db',
          type: 'database',
          display: 'shape',
          title: 'DB',
          size: { width: 200, height: 120 },
        },
        { id: 'doc', type: 'document', display: 'card', title: 'Doc' },
      ],
    };
    expect(toJSON(fromJSON(file))).toEqual(file);
    expect(serializeDeck(file)).toContain('"type": "database",\n      "display": "shape",');
  });

  it('keeps every icon reference byte for byte, readable or not (038)', () => {
    const icons = [
      'lucide:server',
      'server',
      'Server',
      'simple:kafka',
      'lucide:no-such-icon',
      'mdi:database',
      'a b',
    ];
    const file: SododeckFile = {
      ...emptySododeckFile(),
      nodes: icons.map((icon, i) => ({ id: `n${String(i)}`, type: 'service', title: icon, icon })),
    };
    const back = toJSON(fromJSON(file));
    expect(back.nodes.map((n) => n.icon)).toEqual(icons);
    expect(serializeDeck(back)).toBe(serializeDeck(file));
  });
});

describe('database schema (040)', () => {
  const table = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: 'db-table',
    title: id,
    ...extra,
  });

  const dbCases: [string, SododeckFile][] = [
    ['shop schema', shopDeck()],
    ['table with no columns', { ...empty, nodes: [table('t', { columns: [] })] }],
    ['deck with empty enums', { ...empty, enums: [] }],
    ['explicit generic dialect', { ...empty, dialect: 'generic' }],
    // 041: table display (every key, flags both ways, and empty) and enum colours.
    [
      'table display with every key',
      {
        ...empty,
        tableDisplay: {
          detail: 'keys',
          hideTypes: true,
          hideNullable: false,
          hideNotes: true,
          hideIndexes: true,
        },
      },
    ],
    // 042: relationship display with every key.
    [
      'relationship display with every key',
      {
        ...empty,
        tableDisplay: { detail: 'names' },
        relationshipDisplay: { hideEnds: true, labels: 'off', notation: 'numeric' },
      },
    ],
    [
      'enum colours, a palette name and a hex',
      {
        ...empty,
        enums: [
          { id: 'e1', name: 'mood', color: 'violet', values: [] },
          { id: 'e2', name: 'size', note: 'T-shirt.', color: '#d97706', values: [] },
        ],
      },
    ],
    [
      'column flags written false',
      {
        ...empty,
        nodes: [
          table('t', {
            columns: [{ id: 'c', name: 'c', type: 'int', pk: false, notNull: false, default: '0' }],
          }),
        ],
      },
    ],
    [
      'index mixing a column id and an expression',
      {
        ...empty,
        nodes: [
          table('t', {
            columns: [{ id: 'c', name: 'c', type: 'text' }],
            indexes: [{ id: 'i', columns: [{ expr: 'lower(c)' }, 'c'], unique: true }],
          }),
        ],
      },
    ],
    [
      'two relationships between the same tables, an n-n and a self-reference',
      {
        ...empty,
        nodes: [
          table('a', { columns: [{ id: 'a1', name: 'id', type: 'int' }] }),
          table('b', { columns: [{ id: 'b1', name: 'a_id', type: 'int' }] }),
        ],
        edges: [
          { id: 'r1', from: 'b', to: 'a', fromColumns: ['b1'], toColumns: ['a1'] },
          { id: 'r2', from: 'b', to: 'a', cardinality: 'n-n', toOptional: true },
          { id: 'r3', from: 'a', to: 'a', fromColumns: ['a1'], toColumns: ['a1'] },
        ],
      },
    ],
    [
      'table keys on a service card and column keys between services (kept)',
      {
        ...empty,
        nodes: [
          {
            id: 's',
            type: 'service',
            title: 'S',
            schema: 'billing',
            columns: [{ id: 'c', name: 'c', type: 'int' }],
            expanded: true,
          },
          { id: 't', type: 'service', title: 'T' },
        ],
        edges: [{ id: 'e', from: 's', to: 't', fromColumns: ['c'], toColumns: ['nope'] }],
      },
    ],
  ];

  it.each(dbCases)('round-trips the %s losslessly, keys in order', (_name, file) => {
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    expect(`${JSON.stringify(out, null, 2)}\n`).toBe(serializeDeck(file));
  });

  it.each(dbCases)('serializes a replica of the %s identically', (_name, file) => {
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(fromJSON(file)));
    expect(serializeDeck(toJSON(replica))).toBe(serializeDeck(file));
  });

  it('writes dialect and enums right after fieldDefaults, table keys after style', () => {
    const out = toJSON(fromJSON(shuffleKeys(shopDeck())));
    expect(`${JSON.stringify(out, null, 2)}\n`).toBe(serializeDeck(shopDeck()));
    const keys = Object.keys(toJSON(fromJSON(full)));
    expect(keys.indexOf('dialect')).toBe(keys.indexOf('fieldDefaults') + 1);
    expect(keys.indexOf('enums')).toBe(keys.indexOf('dialect') + 1);
    // Stored always (like tagColors), written only with entries (041).
    expect(toJSON(fromJSON({ ...empty, tableDisplay: {} }))).not.toHaveProperty('tableDisplay');
    expect(keys.indexOf('tableDisplay')).toBe(keys.indexOf('enums') + 1);
    // 042: like tableDisplay, a hand-written empty object is not kept.
    expect(toJSON(fromJSON({ ...empty, relationshipDisplay: {} }))).not.toHaveProperty(
      'relationshipDisplay',
    );
    expect(keys.indexOf('relationshipDisplay')).toBe(keys.indexOf('tableDisplay') + 1);
    expect(keys.indexOf('nodes')).toBe(keys.indexOf('relationshipDisplay') + 1);
    const orders = out.nodes.find((n) => n.id === 'orders') ?? {};
    expect(Object.keys(orders)).toEqual([
      'id',
      'type',
      'title',
      'parent',
      'columns',
      'indexes',
      'checks',
    ]);
  });
});

/** A deck saved before 040 (008's logistics screens). */
const logistics = JSON.parse(
  await readFile(
    new URL('../../../specs/008-inspector-rules/screens/logistics.sododeck.json', import.meta.url),
    'utf8',
  ),
) as SododeckFile;

describe('decks saved before 040 stay unchanged (US3)', () => {
  const decks: [string, SododeckFile][] = [
    ['minimal example', minimal],
    ['flow-and-rule example', flowAndRule],
    ['008 logistics deck', logistics],
    ['generated 500-node deck', largeDeck()],
  ];
  const DB_NODE_KEYS = ['schema', 'columns', 'indexes', 'checks', 'expanded', 'detail'];
  const DB_EDGE_KEYS = [
    'fromColumns',
    'toColumns',
    'cardinality',
    'fromOptional',
    'toOptional',
    'onDelete',
    'onUpdate',
  ];

  it.each(decks)('moves a card of the %s and adds no database key', (_name, file) => {
    const doc = fromJSON(file);
    const [first] = file.nodes;
    if (first === undefined) throw new Error('deck has no node');
    createEditor(doc).update('nodes', first.id, { position: { x: 7, y: 9 } });
    const out = toJSON(doc);
    expect(out).not.toHaveProperty('dialect');
    expect(out).not.toHaveProperty('enums');
    expect(out).not.toHaveProperty('tableDisplay');
    expect(out).not.toHaveProperty('relationshipDisplay');
    for (const node of out.nodes)
      for (const key of DB_NODE_KEYS) expect(node).not.toHaveProperty(key);
    for (const edge of out.edges)
      for (const key of DB_EDGE_KEYS) expect(edge).not.toHaveProperty(key);
    const expected = structuredClone(file);
    const moved = expected.nodes[0];
    if (moved !== undefined) moved.position = { x: 7, y: 9 };
    expect(serializeDeck(out)).toBe(serializeDeck(expected));
  });
});

describe('groups as connector ends (050)', () => {
  const grouped: SododeckFile = {
    ...empty,
    nodes: [{ id: 'web', type: 'client', title: 'Web', group: 'edge' }],
    groups: [
      { id: 'edge', title: 'Edge', position: { x: 0, y: 0 }, size: { width: 240, height: 160 } },
      { id: 'core', title: 'Core' },
    ],
    edges: [
      {
        id: 'card-to-group',
        from: 'web',
        to: 'core',
        route: { fromSide: 'right', toSide: 'left', toAt: 0.25 },
        style: { shape: 'elbow', color: 'blue' },
      },
      {
        id: 'group-to-card',
        from: 'core',
        to: 'web',
        label: 'reply',
        route: { waypoints: [{ x: 0.5, dy: 40 }] },
        style: { dash: 'dashed' },
      },
      {
        id: 'group-to-group',
        from: 'edge',
        to: 'core',
        route: { offset: 24 },
        style: { width: 3 },
      },
    ],
    flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'card-to-group' }] }],
  };

  it('round-trips card → group, group → card and group → group with route and style', () => {
    const out = toJSON(fromJSON(grouped));
    expect(out).toEqual(grouped);
    expect(serializeDeck(out)).toBe(`${JSON.stringify(grouped, null, 2)}\n`);
  });

  it('keeps a file without group edges byte-identical', () => {
    for (const file of [minimal, flowAndRule]) {
      expect(serializeDeck(toJSON(fromJSON(file)))).toBe(`${JSON.stringify(file, null, 2)}\n`);
    }
  });
});

describe('node lock (043)', () => {
  const locked: SododeckFile = {
    ...empty,
    nodes: [
      { id: 'svc', type: 'service', title: 'Svc', position: { x: 0, y: 0 }, locked: true },
      { id: 'dia', type: 'diamond', title: 'OK?', size: { width: 96, height: 96 }, locked: true },
      {
        id: 'tbl',
        type: 'db-table',
        title: 'orders',
        columns: [{ id: 'o-id', name: 'id', type: 'bigint', pk: true }],
        detail: 'keys',
        locked: true,
      },
    ],
  };

  it('round-trips a locked card, shape and table, locked last', () => {
    const out = toJSON(fromJSON(locked));
    expect(out).toEqual(locked);
    expect(serializeDeck(out)).toBe(serializeDeck(locked));
    expect(Object.keys(out.nodes[2] ?? {}).at(-1)).toBe('locked');
  });

  it('keeps a deck without locked byte-identical after an unrelated edit', () => {
    const doc = fromJSON(minimal);
    const [first] = minimal.nodes;
    if (first === undefined) throw new Error('deck has no node');
    createEditor(doc).update('nodes', first.id, { title: 'Renamed' });
    const out = toJSON(doc);
    for (const node of out.nodes) expect(node).not.toHaveProperty('locked');
    const expected = structuredClone(minimal);
    const renamed = expected.nodes[0];
    if (renamed !== undefined) renamed.title = 'Renamed';
    expect(serializeDeck(out)).toBe(serializeDeck(expected));
  });
});
