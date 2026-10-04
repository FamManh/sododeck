import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import {
  checkSemanticRules,
  emptySododeckFile,
  jsonSchema,
  parseSododeckFile,
  type SododeckFile,
} from '../src';
import { invalidFixtures, validFixtures } from './fixtures';
import { examples } from './schema-walk';

const ajvValidate = new Ajv2020({ strict: true, allErrors: true }).compile<SododeckFile>(
  jsonSchema,
);

/**
 * What a tool without Zod does (future CLI, AI agents): the published JSON Schema, then the
 * semantic rules it documents but cannot express.
 */
function publishedContractAccepts(input: unknown): boolean {
  return ajvValidate(input) && checkSemanticRules(input).length === 0;
}

/** The published contract and the app's validator must agree on every input. */
function expectBothValidators(input: unknown, valid: boolean) {
  expect(publishedContractAccepts(input), JSON.stringify(ajvValidate.errors)).toBe(valid);
  const result = parseSododeckFile(input);
  expect(result.success, JSON.stringify(result.success ? null : result.issues)).toBe(valid);
}

function issuesOf(input: unknown) {
  const result = parseSododeckFile(input);
  if (result.success) throw new Error('expected the input to be invalid');
  return result.issues;
}

describe('schema v1', () => {
  it('ships the three documented examples', () => {
    expect(examples.map(([file]) => file)).toEqual([
      'flow-and-rule.sododeck.json',
      'full.sododeck.json',
      'minimal.sododeck.json',
    ]);
  });

  it.each(examples)('accepts %s', (_file, example) => {
    expectBothValidators(example, true);
  });

  it.each(examples)('parses %s without changing it (lossless)', (_file, example) => {
    const result = parseSododeckFile(example);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(example);
      expect(JSON.stringify(result.data)).toBe(JSON.stringify(example));
    }
  });

  it('accepts an empty file', () => {
    expectBothValidators(emptySododeckFile(), true);
  });

  it('accepts a node with only id, type and title (every other field is optional)', () => {
    expectBothValidators(
      { ...emptySododeckFile(), nodes: [{ id: 'n1', type: 'service', title: 'Orders' }] },
      true,
    );
  });

  it.each(invalidFixtures)('rejects: $name', ({ input, path }) => {
    expectBothValidators(input, false);
    expect(issuesOf(input).map((issue) => issue.path)).toContain(path);
    for (const issue of issuesOf(input)) expect(issue.message).not.toBe('');
  });

  it.each(validFixtures)('accepts: $name', ({ input }) => {
    expectBothValidators(input, true);
  });

  it('accepts tag colours: named, hex, and keys that differ in more than case (033)', () => {
    const input = {
      ...emptySododeckFile(),
      tagColors: { PCI: 'violet', 'pci-dss': '#7a3cff', Lan: 'slate' },
    };
    expectBothValidators(input, true);
    expectBothValidators({ ...emptySododeckFile(), tagColors: {} }, true);
  });

  it.each([
    'service',
    'database',
    'gateway',
    'client',
    'queue',
    'external',
    'component',
    'task',
    'decision',
    'document',
    'warehouse',
    'truck-route',
    'issue',
    'db-table',
    'robot',
  ])('accepts the type id %s (030)', (type) => {
    expectBothValidators({ ...emptySododeckFile(), nodes: [{ id: 'n1', type, title: 'A' }] }, true);
  });

  it.each(['generic', 'postgres', 'mysql', 'sqlite'])('accepts the dialect %s (040)', (dialect) => {
    expectBothValidators({ ...emptySododeckFile(), dialect }, true);
  });

  it('accepts a sketch table, empty enums and column keys on any card (040)', () => {
    const base = emptySododeckFile();
    expectBothValidators({ ...base, enums: [] }, true);
    expectBothValidators(
      { ...base, nodes: [{ id: 't', type: 'db-table', title: 't', columns: [] }] },
      true,
    );
    expectBothValidators(
      {
        ...base,
        nodes: [
          { id: 'a', type: 'service', title: 'A', columns: [{ id: 'c', name: 'c', type: 'int' }] },
          { id: 'b', type: 'service', title: 'B' },
        ],
        edges: [{ id: 'e', from: 'a', to: 'b', fromColumns: ['c'], toColumns: ['x'] }],
      },
      true,
    );
  });

  it('accepts packs: one, four and an unknown id (030)', () => {
    const base = emptySododeckFile();
    expectBothValidators({ ...base, packs: ['architecture'] }, true);
    expectBothValidators(
      { ...base, packs: ['architecture', 'process', 'logistics', 'data'] },
      true,
    );
    expectBothValidators({ ...base, packs: ['architecture', 'future-pack'] }, true);
  });

  it.each([
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
  ])('accepts the shape type id %s (031)', (type) => {
    expectBothValidators({ ...emptySododeckFile(), nodes: [{ id: 'n1', type, title: 'A' }] }, true);
  });

  it.each(['card', 'shape'])('accepts display "%s" on any node (031)', (display) => {
    for (const type of ['database', 'service', 'diamond', 'robot']) {
      expectBothValidators(
        { ...emptySododeckFile(), nodes: [{ id: 'n1', type, title: 'A', display }] },
        true,
      );
    }
  });

  it('accepts new type ids in view hide and dim lists (030)', () => {
    const view = {
      id: 'v1',
      type: 'custom',
      title: 'V',
      excludeKinds: ['warehouse', 'robot'],
      dimKinds: ['truck-route'],
    };
    expectBothValidators({ ...emptySododeckFile(), views: [view] }, true);
  });

  describe('typed fields (032)', () => {
    const base = emptySododeckFile();
    const kinds = [
      'text',
      'number',
      'select',
      'status',
      'person',
      'date',
      'dateRange',
      'link',
      'progress',
    ] as const;

    it.each(kinds)('accepts a %s field', (kind) => {
      expectBothValidators({ ...base, fields: [{ id: 'f1', name: 'F', kind }] }, true);
    });

    it('accepts built-in entries with their fixed kinds and fieldDefaults', () => {
      expectBothValidators(
        {
          ...base,
          fields: [
            { id: 'tech', name: 'Tech', kind: 'text', onCard: true },
            { id: 'host', name: 'Host', kind: 'text' },
            { id: 'owner', name: 'Owner', kind: 'person', onCard: true },
          ],
          fieldDefaults: ['task', 'robot'],
        },
        true,
      );
    });

    it('accepts every value shape', () => {
      const values = {
        a: 'text',
        b: 3.5,
        c: { from: '2026-10-06', to: '2026-10-17' },
        d: { url: 'https://example.com' },
        e: { url: 'mailto:a@example.com', label: 'Mail' },
      };
      expectBothValidators(
        { ...base, nodes: [{ id: 'n1', type: 'task', title: 'A', values }] },
        true,
      );
    });

    it('accepts dangling values: unknown field, unknown option, wrong shape for the kind', () => {
      expectBothValidators(
        {
          ...base,
          fields: [
            { id: 'p', name: 'Progress', kind: 'progress' },
            { id: 'd', name: 'Due', kind: 'date' },
            { id: 's', name: 'Size', kind: 'select', options: [{ id: 'o1', label: 'S' }] },
          ],
          nodes: [
            {
              id: 'n1',
              type: 'task',
              title: 'A',
              values: { p: 140, d: '14/10', s: 'gone', missing: 'kept', d2: { url: 'x' } },
            },
          ],
        },
        true,
      );
    });
  });

  it('names the allowed values when an enum value is wrong', () => {
    const [issue] = issuesOf({
      ...emptySododeckFile(),
      edges: [{ id: 'e1', from: 'a', to: 'b', protocol: 'HTTPS' }],
    });
    expect(issue?.path).toBe('edges.0.protocol');
    for (const value of ['http', 'grpc', 'event', 'sql', 'websocket', 'other']) {
      expect(issue?.message).toContain(value);
    }
  });

  it('names the key when an object has an unknown key', () => {
    const [issue] = issuesOf({
      ...emptySododeckFile(),
      nodes: [{ id: 'n1', type: 'service', title: 'A', kind: 'service' }],
    });
    expect(issue).toMatchObject({ path: 'nodes.0' });
    expect(issue?.message).toContain('"kind"');
  });

  it('points at a flow step that has no id', () => {
    const issues = issuesOf({
      ...emptySododeckFile(),
      flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'e1' }, { edge: 'e2' }] }],
    });
    expect(issues.map((issue) => issue.path)).toEqual(['flows.0.steps.1.id']);
  });

  it('names the rule and the row when a row has the wrong number of cells', () => {
    const issues = issuesOf({
      ...emptySododeckFile(),
      rules: {
        'R-12': {
          title: 'Return to sender',
          hitPolicy: 'first',
          inputs: [
            { id: 'fails', label: 'Failures' },
            { id: 'cod', label: 'COD' },
          ],
          outputs: [{ id: 'action', label: 'Action' }],
          rows: [{ id: 'row-1', when: ['>= 3'], then: ['Return'] }],
        },
      },
    });
    expect(issues).toEqual([
      {
        path: 'rules.R-12.rows.0.when',
        message: 'Rule "R-12" row "row-1" has 1 "when" cell but 2 input columns.',
      },
    ]);
  });

  it('validates a large deck quickly (500 nodes, 1,000 edges, 50 flows)', () => {
    const large: SododeckFile = {
      ...emptySododeckFile(),
      nodes: Array.from({ length: 500 }, (_, i) => ({
        id: `n${String(i)}`,
        type: 'service' as const,
        title: `Node ${String(i)}`,
        tags: ['a', 'b'],
        position: { x: i * 10, y: i * 5 },
      })),
      edges: Array.from({ length: 1000 }, (_, i) => ({
        id: `e${String(i)}`,
        from: `n${String(i % 500)}`,
        to: `n${String((i * 7 + 1) % 500)}`,
        protocol: 'http' as const,
        label: `call ${String(i)}`,
      })),
      flows: Array.from({ length: 50 }, (_, f) => ({
        id: `f${String(f)}`,
        title: `Flow ${String(f)}`,
        steps: Array.from({ length: 10 }, (_, s) => ({
          id: `f${String(f)}-s${String(s)}`,
          edge: `e${String(f * 10 + s)}`,
          condition: 'always',
        })),
      })),
    };
    const durations = [0, 1, 2].map(() => {
      const start = performance.now();
      expect(parseSododeckFile(large).success).toBe(true);
      return performance.now() - start;
    });
    const median = [...durations].sort((a, b) => a - b)[1] ?? Infinity;
    expect(median).toBeLessThan(100);
  });

  it('reports issue paths', () => {
    const result = parseSododeckFile({
      ...emptySododeckFile(),
      nodes: [{ id: '', type: 'service', title: 'x' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.path).toBe('nodes.0.id');
  });
});
