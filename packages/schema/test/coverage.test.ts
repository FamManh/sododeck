import { describe, expect, it } from 'vitest';

import { defs, readExample, root, walk } from './schema-walk';

/**
 * `examples/full.sododeck.json` is the proof that the format can hold everything the design shows
 * (spec FR-025, SC-001): it must use every property of every object type and every enum value.
 */
const full = readExample('full.sododeck.json');

const usedProperties = new Map<string, Set<string>>();
const usedEnumValues = new Map<string, Set<unknown>>();

walk(full, {
  object(type, value) {
    const set = usedProperties.get(type) ?? new Set<string>();
    for (const key of Object.keys(value)) set.add(key);
    usedProperties.set(type, set);
  },
  enumValue(type, value) {
    const set = usedEnumValues.get(type) ?? new Set<unknown>();
    set.add(value);
    usedEnumValues.set(type, set);
  },
});

const objectTypes = [
  ['SododeckFile', root] as const,
  ...Object.entries(defs).filter(([, schema]) => schema.properties !== undefined),
];
/**
 * Enums a file holds at most once (the root `dialect`, 040): the example uses one value and
 * `schema.test.ts` accepts each of the others.
 */
const ONE_PER_FILE = new Set(['Dialect']);
const enumTypes = Object.entries(defs).filter(
  ([type, schema]) => schema.enum !== undefined && !ONE_PER_FILE.has(type),
);

/**
 * Deprecated properties the format still reads for older files but no current deck writes
 * (ADR 0041: `Sticky.anchor`). `fixtures.ts` keeps a valid file for each.
 */
const DEPRECATED: Record<string, readonly string[]> = { Sticky: ['anchor'] };

describe('full example covers the whole format', () => {
  it.each(objectTypes)('uses every property of %s', (type, schema) => {
    const deprecated = DEPRECATED[type] ?? [];
    const expected = Object.keys(schema.properties ?? {}).filter(
      (key) => !deprecated.includes(key),
    );
    expect([...(usedProperties.get(type) ?? [])].sort()).toEqual(expected.sort());
  });

  it.each([...ONE_PER_FILE])('uses one value of %s', (type) => {
    expect(usedEnumValues.get(type)?.size).toBe(1);
  });

  it.each(enumTypes)('uses every value of %s', (type, schema) => {
    const expected = schema.enum ?? [];
    expect([...(usedEnumValues.get(type) ?? [])].sort()).toEqual([...expected].sort());
  });
});
