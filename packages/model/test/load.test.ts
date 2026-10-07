import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  DeckValidationError,
  fromJSON,
  loadDeck,
  observeDeck,
  prepareDeck,
  serializeDeck,
  toJSON,
} from '../src';
import { buildDoc, isPreparedDeck } from '../src/deck';
import { readExample, reopen } from './helpers';
import { picture } from './image-helpers';

function loadError(input: unknown): DeckValidationError {
  try {
    fromJSON(input);
  } catch (error) {
    if (error instanceof DeckValidationError) return error;
    throw error;
  }
  throw new Error('expected the load to be refused');
}

const node = (id: string) => ({ id, type: 'service' as const, title: id });
const rule = (patch: Partial<SododeckFile['rules'][string]> = {}) => ({
  title: 'R',
  hitPolicy: 'first' as const,
  inputs: [],
  outputs: [],
  rows: [],
  ...patch,
});

describe('loading (US2 AS3–5, FR-019–021)', () => {
  it('refuses an invalid file with the problems and their locations', () => {
    const error = loadError({
      ...emptySododeckFile(),
      nodes: [{ id: 'a', type: 'Lambda', title: '' }],
    });
    expect(error.issues.map((i) => i.path)).toEqual(['/nodes/0/type', '/nodes/0/title']);
  });

  it.each([
    [
      'nodes',
      { nodes: [node('x'), node('a'), node('b'), node('x')] },
      '/nodes/0/id',
      '/nodes/3/id',
    ],
    [
      'groups',
      {
        groups: [
          { id: 'x', title: 'A' },
          { id: 'x', title: 'B' },
        ],
      },
      '/groups/0/id',
      '/groups/1/id',
    ],
    [
      'edges',
      {
        nodes: [node('a')],
        edges: [
          { id: 'x', from: 'a', to: 'a' },
          { id: 'x', from: 'a', to: 'a' },
        ],
      },
      '/edges/0/id',
      '/edges/1/id',
    ],
    [
      'views',
      {
        views: [
          { id: 'x', type: 'system', title: 'A' },
          { id: 'x', type: 'infra', title: 'B' },
        ],
      },
      '/views/0/id',
      '/views/1/id',
    ],
    [
      'features',
      {
        features: [
          { id: 'x', title: 'A' },
          { id: 'x', title: 'B' },
        ],
      },
      '/features/0/id',
      '/features/1/id',
    ],
    [
      'flows',
      {
        flows: [
          { id: 'x', title: 'A', steps: [] },
          { id: 'x', title: 'B', steps: [] },
        ],
      },
      '/flows/0/id',
      '/flows/1/id',
    ],
    [
      'stickies',
      {
        stickies: [
          { id: 'x', text: 'A', anchor: 'q' },
          { id: 'x', text: 'B', anchor: 'q' },
        ],
      },
      '/stickies/0/id',
      '/stickies/1/id',
    ],
    [
      'steps within one flow',
      {
        flows: [
          {
            id: 'f',
            title: 'F',
            steps: [
              { id: 'x', edge: 'e' },
              { id: 'y', edge: 'e' },
              { id: 'x', edge: 'e' },
            ],
          },
        ],
      },
      '/flows/0/steps/0/id',
      '/flows/0/steps/2/id',
    ],
    [
      'rule columns across inputs and outputs',
      {
        rules: {
          R: rule({ inputs: [{ id: 'x', label: 'In' }], outputs: [{ id: 'x', label: 'Out' }] }),
        },
      },
      '/rules/R/inputs/0/id',
      '/rules/R/outputs/0/id',
    ],
    [
      'rule rows',
      {
        rules: {
          R: rule({
            rows: [
              { id: 'x', when: [], then: [] },
              { id: 'x', when: [], then: [] },
            ],
          }),
        },
      },
      '/rules/R/rows/0/id',
      '/rules/R/rows/1/id',
    ],
  ])(
    'refuses duplicate ids in %s, naming the id and both locations (FR-020)',
    (_name, patch, first, second) => {
      const error = loadError({ ...emptySododeckFile(), ...patch });
      expect(error.issues).toHaveLength(1);
      const [issue] = error.issues;
      expect(issue?.message).toContain('"x"');
      expect(issue?.message).toContain(first);
      expect(issue?.message).toContain(second);
      expect(issue?.path).toBe(second);
    },
  );

  it('reports each duplicated id once, and several ids separately', () => {
    const error = loadError({
      ...emptySododeckFile(),
      nodes: [node('x'), node('x'), node('x'), node('y'), node('y')],
    });
    expect(error.issues.map((i) => i.message)).toEqual([
      'Id "x" is used more than once (/nodes/0/id, /nodes/1/id, /nodes/2/id).',
      'Id "y" is used more than once (/nodes/3/id, /nodes/4/id).',
    ]);
  });

  it('allows the same id in different collections, and the same step id in two flows', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [node('x')],
      groups: [{ id: 'x', title: 'G' }],
      flows: [
        { id: 'f1', title: 'A', steps: [{ id: 's', edge: 'e' }] },
        { id: 'f2', title: 'B', steps: [{ id: 's', edge: 'e' }] },
      ],
      rules: {
        R: rule({ inputs: [{ id: 'c', label: 'C' }], rows: [{ id: 'c', when: [''], then: [] }] }),
      },
    };
    expect(toJSON(fromJSON(file))).toEqual(file);
  });

  it('refuses a connector end naming an id held by both a node and a group (050)', () => {
    const error = loadError({
      ...emptySododeckFile(),
      nodes: [node('x'), node('y')],
      groups: [{ id: 'x', title: 'G' }],
      edges: [{ id: 'e', from: 'y', to: 'x' }],
    });
    expect(error.issues).toEqual([
      {
        code: 'ambiguous-end',
        path: '/groups/0/id',
        subject: 'x',
        evidence: '"x"',
        message:
          'Id "x" names both a node and a group, so connector ends naming it are ambiguous (/nodes/0/id, /groups/0/id).',
      },
    ]);
  });

  it('codes a duplicate id with its id as subject and evidence (062)', () => {
    const error = loadError({ ...emptySododeckFile(), nodes: [node('api'), node('api')] });
    expect(error.issues).toEqual([
      {
        code: 'duplicate-id',
        path: '/nodes/1/id',
        subject: 'api',
        message: 'Id "api" is used more than once (/nodes/0/id, /nodes/1/id).',
        evidence: '"api"',
      },
    ]);
  });

  it('reports format rules and duplicate ids together in one round (062 R5)', () => {
    const error = loadError({
      ...emptySododeckFile(),
      nodes: [node('x'), node('x')],
      groups: [{ id: 'g', title: 'G', position: { x: 0, y: 0 } }],
    });
    expect(error.issues.map((i) => [i.code, i.path])).toEqual([
      ['group-frame-pair', '/groups/0'],
      ['duplicate-id', '/nodes/1/id'],
    ]);
  });

  it('refuses a connector end naming an id held by a sticky and a node or a group (053)', () => {
    const note = (id: string) => ({ id, text: id, position: { x: 0, y: 0 } });
    const withNode = loadError({
      ...emptySododeckFile(),
      nodes: [node('x'), node('y')],
      stickies: [note('x')],
      edges: [{ id: 'e', from: 'y', to: 'x' }],
    });
    expect(withNode.issues).toMatchObject([
      {
        path: '/stickies/0/id',
        message:
          'Id "x" names both a node and a sticky, so connector ends naming it are ambiguous (/nodes/0/id, /stickies/0/id).',
      },
    ]);
    const withGroup = loadError({
      ...emptySododeckFile(),
      nodes: [node('y')],
      groups: [{ id: 'g', title: 'G' }],
      stickies: [note('g')],
      edges: [{ id: 'e', from: 'y', to: 'g' }],
    });
    expect(withGroup.issues).toMatchObject([
      {
        path: '/stickies/0/id',
        message:
          'Id "g" names both a group and a sticky, so connector ends naming it are ambiguous (/groups/0/id, /stickies/0/id).',
      },
    ]);
  });

  it('loads a node and a sticky sharing an id when no connector names it (053)', () => {
    const file = {
      ...emptySododeckFile(),
      nodes: [node('x')],
      stickies: [{ id: 'x', text: 'x', position: { x: 0, y: 0 } }],
    };
    expect(toJSON(fromJSON(file))).toEqual(file);
  });

  describe('database parts share one id scope (040)', () => {
    const table = (id: string, extra: Record<string, unknown>) => ({
      id,
      type: 'db-table',
      title: id,
      ...extra,
    });
    const col = (id: string) => ({ id, name: id, type: 'int' });

    it('refuses a column id used in two tables, naming both paths', () => {
      const error = loadError({
        ...emptySododeckFile(),
        nodes: [table('a', { columns: [col('x')] }), table('b', { columns: [col('y'), col('x')] })],
      });
      expect(error.issues).toMatchObject([
        {
          path: '/nodes/1/columns/1/id',
          message: 'Id "x" is used more than once (/nodes/0/columns/0/id, /nodes/1/columns/1/id).',
        },
      ]);
    });

    it('refuses a column id equal to an enum value id', () => {
      const error = loadError({
        ...emptySododeckFile(),
        enums: [{ id: 'e', name: 'e', values: [{ id: 'v', name: 'v' }] }],
        nodes: [table('a', { columns: [col('v')] })],
      });
      expect(error.issues.map((i) => i.message)).toEqual([
        'Id "v" is used more than once (/nodes/0/columns/0/id, /enums/0/values/0/id).',
      ]);
    });

    it('refuses a duplicate index id inside one table, and a check reusing a column id', () => {
      const error = loadError({
        ...emptySododeckFile(),
        nodes: [
          table('a', {
            columns: [col('c')],
            indexes: [
              { id: 'i', columns: ['c'] },
              { id: 'i', columns: ['c'] },
            ],
            checks: [{ id: 'c', expr: 'true' }],
          }),
        ],
      });
      // In order of first use: the check reuses column "c", then index "i" repeats.
      expect(error.issues.map((i) => i.path)).toEqual([
        '/nodes/0/checks/0/id',
        '/nodes/0/indexes/1/id',
      ]);
    });

    it('accepts a column id equal to a node id', () => {
      const file: SododeckFile = {
        ...emptySododeckFile(),
        nodes: [table('a', { columns: [col('a')] })],
      };
      expect(toJSON(fromJSON(file))).toEqual(file);
    });
  });

  it('loads a file with dangling references (US2 AS5)', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [node('a')],
      edges: [{ id: 'e', from: 'a', to: 'gone' }],
      flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'missing' }] }],
    };
    expect(toJSON(fromJSON(file))).toEqual(file);
  });

  it.each(['minimal', 'flow-and-rule', 'full'])('loads the %s example', async (name) => {
    const file = await readExample(`${name}.sododeck.json`);
    expect(reopen(file)).toEqual(file);
  });
});

describe('decks saved before tag colours (033, US5)', () => {
  it.each(['minimal.sododeck.json', 'flow-and-rule.sododeck.json'])(
    '%s loads and comes back byte-identical with no tagColors key',
    async (name) => {
      const file = await readExample(name);
      expect(file).not.toHaveProperty('tagColors');
      const doc = fromJSON(file);
      expect(toJSON(doc)).not.toHaveProperty('tagColors');
      expect(serializeDeck(toJSON(doc))).toBe(serializeDeck(file));
    },
  );

  it('opening one and reading it makes no write', async () => {
    const doc = fromJSON(await readExample('flow-and-rule.sododeck.json'));
    let transactions = 0;
    doc.on('afterTransaction', () => {
      transactions += 1;
    });
    observeDeck(doc, () => {
      transactions += 1;
    });
    createEditor(doc);
    toJSON(doc);
    expect(transactions).toBe(0);
  });
});

describe('prepareDeck (066 R6)', () => {
  it('returns the validated file, picture facts and bytes for the full example', async () => {
    const full = await readExample('full.sododeck.json');
    const prepared = prepareDeck(full);
    expect(toJSON(buildDoc(prepared))).toEqual(toJSON(loadDeck(full).doc));
    expect(prepared.file.nodes).toHaveLength(full.nodes.length);
    expect(prepared.problems).toEqual([]);
    expect(prepared.trimmedCrops).toEqual([]);
    // Every picture has bytes except the ones that point at a file (068).
    expect(prepared.bytes.size + prepared.fileRefs.length).toBe(prepared.metas.size);
  });

  it('frees a legacy anchored note in the prepared file', () => {
    const prepared = prepareDeck({
      ...emptySododeckFile(),
      nodes: [{ ...node('n'), position: { x: 100, y: 100 } }],
      stickies: [{ id: 's', text: 'On n', anchor: 'n' }],
    });
    const sticky = prepared.file.stickies[0];
    expect(sticky).not.toHaveProperty('anchor');
    expect(sticky?.position).toBeDefined();
  });

  it('lists a damaged picture and keeps a placeholder meta', () => {
    const p = picture(1);
    const prepared = prepareDeck({
      ...emptySododeckFile(),
      images: [
        { id: 'img-a', asset: p.id, position: { x: 0, y: 0 }, size: { width: 50, height: 50 } },
      ],
      assets: { [p.id]: { ...p.meta, data: '!!not base64!!' } },
    });
    expect(prepared.problems).toEqual([{ id: p.id, name: p.meta.name, reason: 'bad-data' }]);
    expect(prepared.metas.get(p.id)).toEqual({ ...p.meta, bytes: 1 });
    expect(prepared.bytes.size).toBe(0);
  });

  it('lists an over-wide crop as trimmed', () => {
    const p = picture(1);
    const prepared = prepareDeck({
      ...emptySododeckFile(),
      images: [
        {
          id: 'img-a',
          asset: p.id,
          position: { x: 0, y: 0 },
          size: { width: 50, height: 50 },
          crop: { x: 0.6, y: 0, width: 0.6, height: 1 },
        },
      ],
      assets: { [p.id]: { ...p.meta, data: p.data } },
    });
    expect(prepared.trimmedCrops).toEqual([{ imageId: 'img-a', path: '/images/0/crop' }]);
    expect(prepared.file.images?.[0]?.crop?.width).toBeCloseTo(0.4);
  });

  it('throws DeckValidationError for a file load refuses (a rule row with too few cells)', () => {
    const rows = [{ id: 'r', when: [], then: [] }];
    const inputs = [{ id: 'i', label: 'I' }];
    expect(() =>
      prepareDeck({ ...emptySododeckFile(), rules: { R: rule({ inputs, rows }) } }),
    ).toThrow(DeckValidationError);
  });

  it('is recognised by its brand, not by its shape', () => {
    const prepared = prepareDeck(emptySododeckFile());
    expect(isPreparedDeck(prepared)).toBe(true);
    expect(isPreparedDeck({ ...prepared })).toBe(true);
    expect(isPreparedDeck(structuredClone({ file: prepared.file }))).toBe(false);
  });
});
