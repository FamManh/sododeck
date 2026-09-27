import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import { emptySododeckFile, jsonSchema, parseSododeckFile } from '../src';
import { examples } from './schema-walk';

const ajvValidate = new Ajv2020({ strict: true, allErrors: true }).compile(jsonSchema);

/** The published JSON Schema and the app's validator must agree on every input. */
function expectBothValidators(input: unknown, valid: boolean) {
  expect(ajvValidate(input), JSON.stringify(ajvValidate.errors)).toBe(valid);
  const result = parseSododeckFile(input);
  expect(result.success, JSON.stringify(result.success ? null : result.issues)).toBe(valid);
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

  it('reports issue paths', () => {
    const result = parseSododeckFile({
      ...emptySododeckFile(),
      nodes: [{ id: '', type: 'service', title: 'x' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.path).toBe('nodes.0.id');
  });
});
