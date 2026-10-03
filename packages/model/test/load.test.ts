import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  DeckValidationError,
  fromJSON,
  observeDeck,
  serializeDeck,
  toJSON,
} from '../src';
import { readExample } from './helpers';

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
    expect(error.issues.map((i) => i.path)).toEqual(['nodes.0.type', 'nodes.0.title']);
  });

  it.each([
    ['nodes', { nodes: [node('x'), node('a'), node('b'), node('x')] }, 'nodes.0.id', 'nodes.3.id'],
    [
      'groups',
      {
        groups: [
          { id: 'x', title: 'A' },
          { id: 'x', title: 'B' },
        ],
      },
      'groups.0.id',
      'groups.1.id',
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
      'edges.0.id',
      'edges.1.id',
    ],
    [
      'views',
      {
        views: [
          { id: 'x', type: 'system', title: 'A' },
          { id: 'x', type: 'infra', title: 'B' },
        ],
      },
      'views.0.id',
      'views.1.id',
    ],
    [
      'features',
      {
        features: [
          { id: 'x', title: 'A' },
          { id: 'x', title: 'B' },
        ],
      },
      'features.0.id',
      'features.1.id',
    ],
    [
      'flows',
      {
        flows: [
          { id: 'x', title: 'A', steps: [] },
          { id: 'x', title: 'B', steps: [] },
        ],
      },
      'flows.0.id',
      'flows.1.id',
    ],
    [
      'stickies',
      {
        stickies: [
          { id: 'x', text: 'A', anchor: 'q' },
          { id: 'x', text: 'B', anchor: 'q' },
        ],
      },
      'stickies.0.id',
      'stickies.1.id',
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
      'flows.0.steps.0.id',
      'flows.0.steps.2.id',
    ],
    [
      'rule columns across inputs and outputs',
      {
        rules: {
          R: rule({ inputs: [{ id: 'x', label: 'In' }], outputs: [{ id: 'x', label: 'Out' }] }),
        },
      },
      'rules.R.inputs.0.id',
      'rules.R.outputs.0.id',
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
      'rules.R.rows.0.id',
      'rules.R.rows.1.id',
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
      'Id "x" is used more than once (nodes.0.id, nodes.1.id, nodes.2.id).',
      'Id "y" is used more than once (nodes.3.id, nodes.4.id).',
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
    expect(toJSON(fromJSON(file))).toEqual(file);
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
