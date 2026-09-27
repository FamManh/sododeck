import { readFile } from 'node:fs/promises';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import { emptySododeckFile, jsonSchema, parseSododeckFile } from '../src';

const example: unknown = JSON.parse(
  await readFile(new URL('../examples/minimal.sododeck.json', import.meta.url), 'utf8'),
);

const ajvValidate = new Ajv2020({ strict: true, allErrors: true }).compile(jsonSchema);

/** Zod and the JSON Schema must agree on every fixture. */
function expectBothValidators(input: unknown, valid: boolean) {
  expect(ajvValidate(input), JSON.stringify(ajvValidate.errors)).toBe(valid);
  expect(parseSododeckFile(input).success).toBe(valid);
}

describe('schema v1 skeleton', () => {
  it('accepts the bundled example', () => {
    expectBothValidators(example, true);
  });

  it('accepts an empty file', () => {
    expectBothValidators(emptySododeckFile(), true);
  });

  it.each([
    ['missing $schema', { ...emptySododeckFile(), $schema: undefined }],
    ['wrong version', { ...emptySododeckFile(), version: 2 }],
    ['unknown top-level key', { ...emptySododeckFile(), extra: true }],
    ['node without id', { ...emptySododeckFile(), nodes: [{ title: 'x' }] }],
    ['node with empty id', { ...emptySododeckFile(), nodes: [{ id: '' }] }],
    ['rules as array', { ...emptySododeckFile(), rules: [] }],
  ])('rejects %s', (_name, input) => {
    expectBothValidators(JSON.parse(JSON.stringify(input)), false);
  });

  it('reports issue paths', () => {
    const result = parseSododeckFile({ ...emptySododeckFile(), nodes: [{ id: '' }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.path).toBe('nodes.0.id');
  });
});
