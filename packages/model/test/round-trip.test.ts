import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createDeck, createEditor, fromJSON, serializeDeck, toJSON } from '../src';
import { readExample } from './helpers';

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
        { id: 'g', title: 'Inner', description: 'Nested', parent: 'outer' },
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

const cases: [string, SododeckFile][] = [
  ['empty deck', empty],
  ['minimal example', minimal],
  ['flow-and-rule example', flowAndRule],
  ['full example', full],
  ...perType,
];

describe('round-trip (US2 AS1, FR-022/023)', () => {
  it('createDeck() produces an empty valid file', () => {
    expect(toJSON(createDeck())).toEqual(emptySododeckFile());
  });

  it.each(cases)('round-trips the %s losslessly', (_name, file) => {
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    expect(serializeDeck(out)).toBe(serializeDeck(file));
    expect(serializeDeck(out)).toBe(`${JSON.stringify(file, null, 2)}\n`);
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
  /^views\.\d+\.positions$/,
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
