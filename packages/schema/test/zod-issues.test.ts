import { describe, expect, it } from 'vitest';

import {
  emptySododeckFile,
  parseSododeckFile,
  sododeckFileSchema,
  toIssues,
  type Issue,
} from '../src';

const base = emptySododeckFile();

function issuesOf(input: unknown): Issue[] {
  const result = sododeckFileSchema.safeParse(input);
  if (result.success) throw new Error('expected the input to be refused');
  return toIssues(result.error, input);
}

const card = (extra: Record<string, unknown> = {}) => ({
  id: 'payments',
  type: 'service',
  title: 'Payments',
  ...extra,
});

describe('toIssues (062 R3)', () => {
  it('reports a missing required key as schema-required with a composed fix', () => {
    const { title: _title, ...noTitle } = card();
    expect(issuesOf({ ...base, nodes: [noTitle] })).toEqual([
      {
        code: 'schema-required',
        path: '/nodes/0/title',
        subject: 'payments',
        message: '"title" is missing.',
        fix: 'Add "title" (a string) to node "payments".',
      },
    ]);
  });

  it('reports a wrong type as schema-type with the value as evidence', () => {
    expect(issuesOf({ ...base, nodes: [card({ title: 5 })] })).toEqual([
      {
        code: 'schema-type',
        path: '/nodes/0/title',
        subject: 'payments',
        message: '"title" should be a string, not a number.',
        evidence: '5',
        fix: 'Make "title" a string.',
      },
    ]);
  });

  it('reports a value outside a list as schema-enum listing the allowed values', () => {
    const [issue] = issuesOf({
      ...base,
      edges: [{ id: 'e1', from: 'a', to: 'b', protocol: 'xyz' }],
    });
    expect(issue).toEqual({
      code: 'schema-enum',
      path: '/edges/0/protocol',
      subject: 'e1',
      message: '"protocol" has a value that is not allowed.',
      evidence: '"xyz"',
      fix: 'Use one of: "http", "grpc", "event", "sql", "websocket", "other".',
    });
  });

  it('caps a long allowed list at 12 values', () => {
    const [issue] = issuesOf({ ...base, nodes: [card({ style: { fill: 5 } })] });
    // ColorRef is a union; a number matches no branch, so every branch's shape is listed.
    expect(issue?.code).toBe('schema-union');
    expect(issue?.fix).toContain('…');
  });

  it('spells out the id pattern', () => {
    expect(issuesOf({ ...base, nodes: [card({ id: 'a b' })] })).toEqual([
      {
        code: 'schema-pattern',
        path: '/nodes/0/id',
        subject: 'a b',
        message: '"id" does not have the expected format.',
        evidence: '"a b"',
        fix: 'Make "id" 1–64 letters, digits, -, _, . or :.',
      },
    ]);
  });

  it('reports a bound as schema-range', () => {
    const [issue] = issuesOf({ ...base, nodes: [card({ size: { width: -1, height: 2 } })] });
    expect(issue).toMatchObject({
      code: 'schema-range',
      path: '/nodes/0/size/width',
      subject: 'payments',
      evidence: '-1',
      fix: 'Make "width" greater than 0.',
    });
  });

  it('reports each unknown key on a strict object with a path to the key', () => {
    expect(issuesOf({ ...base, nodes: [card({ foo: 1, 'a/b': true })] })).toEqual([
      {
        code: 'schema-unknown-field',
        path: '/nodes/0/foo',
        subject: 'payments',
        message: '"foo" is not a known field here.',
        evidence: '1',
        fix: 'Remove "foo".',
      },
      {
        code: 'schema-unknown-field',
        path: '/nodes/0/a~1b',
        subject: 'payments',
        message: '"a/b" is not a known field here.',
        evidence: 'true',
        fix: 'Remove "a/b".',
      },
    ]);
  });

  it('reports a ColorRef that matches no branch as schema-union', () => {
    const [issue] = issuesOf({ ...base, nodes: [card({ style: { fill: true } })] });
    expect(issue).toMatchObject({
      code: 'schema-union',
      path: '/nodes/0/style/fill',
      subject: 'payments',
      evidence: 'true',
    });
    expect(issue?.fix).toMatch(/^Make "fill" one of: "red", "orange"/);
  });

  it('reports the closest branch of a FieldValue union', () => {
    expect(issuesOf({ ...base, nodes: [card({ values: { link: { url: 3 } } })] })).toEqual([
      {
        code: 'schema-type',
        path: '/nodes/0/values/link/url',
        subject: 'payments',
        message: '"url" should be a string, not a number.',
        evidence: '3',
        fix: 'Make "url" a string.',
      },
    ]);
  });

  it('points a duplicate in a unique list at the repeated item', () => {
    expect(issuesOf({ ...base, swatches: ['#000000', '#111111', '#000000'] })).toEqual([
      {
        code: 'schema-unique',
        path: '/swatches/2',
        message: '"swatches" lists the same value more than once.',
        evidence: '"#000000"',
        fix: 'Remove the repeated entry from "swatches".',
      },
    ]);
  });

  it('reports a root that is not an object at the root path', () => {
    expect(issuesOf([1, 2])).toEqual([
      {
        code: 'schema-type',
        path: '',
        message: 'The file is not a JSON object.',
        evidence: '[1,2]',
        fix: 'Make the file one JSON object with "$schema", "version", "nodes" and the other top-level keys.',
      },
    ]);
  });

  it('uses the map key as the subject for rules and assets', () => {
    const [issue] = issuesOf({
      ...base,
      rules: {
        'delivery-tier': { title: 'Tier', hitPolicy: 'first', inputs: [], outputs: [], rows: 5 },
      },
    });
    expect(issue).toMatchObject({ path: '/rules/delivery-tier/rows', subject: 'delivery-tier' });
  });

  it('trims long evidence to 200 characters', () => {
    const [issue] = issuesOf({ ...base, nodes: [card({ title: ['x'.repeat(500)] })] });
    expect(issue?.evidence).toHaveLength(200);
    expect(issue?.evidence?.endsWith('…')).toBe(true);
  });

  it('is what parseSododeckFile returns', () => {
    const result = parseSododeckFile({ ...base, nodes: [card({ title: 5 })] });
    expect(result.success ? [] : result.issues.map((i) => i.code)).toEqual(['schema-type']);
  });
});
