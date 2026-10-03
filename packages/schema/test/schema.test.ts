import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import {
  checkSemanticRules,
  emptySododeckFile,
  jsonSchema,
  parseSododeckFile,
  type SododeckFile,
} from '../src';
import { invalidFixtures } from './fixtures';
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

  it('accepts tag colours: named, hex, and keys that differ in more than case (033)', () => {
    const input = {
      ...emptySododeckFile(),
      tagColors: { PCI: 'violet', 'pci-dss': '#7a3cff', Lan: 'slate' },
    };
    expectBothValidators(input, true);
    expectBothValidators({ ...emptySododeckFile(), tagColors: {} }, true);
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
