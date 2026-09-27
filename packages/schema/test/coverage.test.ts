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
const enumTypes = Object.entries(defs).filter(([, schema]) => schema.enum !== undefined);

describe('full example covers the whole format', () => {
  it.each(objectTypes)('uses every property of %s', (type, schema) => {
    const expected = Object.keys(schema.properties ?? {});
    expect([...(usedProperties.get(type) ?? [])].sort()).toEqual(expected.sort());
  });

  it.each(enumTypes)('uses every value of %s', (type, schema) => {
    const expected = schema.enum ?? [];
    expect([...(usedEnumValues.get(type) ?? [])].sort()).toEqual([...expected].sort());
  });
});
