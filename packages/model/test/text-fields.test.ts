import { jsonSchema } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { isRecord } from '../src/convert';
import { isTextField, TEXT_FIELDS, type TextKind } from '../src/text-fields';

const root = jsonSchema as unknown as {
  properties: Record<string, unknown>;
  $defs: Record<string, { properties?: Record<string, unknown> }>;
};

/** Which schema definition holds the fields of each kind. */
const DEFS: Record<Exclude<TextKind, 'meta'>, string> = {
  nodes: 'Node',
  groups: 'Group',
  edges: 'Edge',
  views: 'View',
  features: 'Feature',
  flows: 'Flow',
  stickies: 'Sticky',
  images: 'Image',
  step: 'Step',
  branch: 'Branch',
  rule: 'Rule',
  column: 'RuleColumn',
  row: 'RuleRow',
  dbColumn: 'DbColumn',
  dbIndex: 'DbIndex',
  dbCheck: 'DbCheck',
  enum: 'DbEnum',
  enumValue: 'DbEnumValue',
};

function propertiesOf(kind: TextKind): Record<string, unknown> {
  return kind === 'meta' ? root.properties : (root.$defs[DEFS[kind]]?.properties ?? {});
}

const isMarkdown = (property: unknown) =>
  isRecord(property) &&
  property.type === 'string' &&
  typeof property.description === 'string' &&
  property.description.includes('(markdown)');

describe('TEXT_FIELDS', () => {
  const kinds = Object.keys(TEXT_FIELDS) as TextKind[];

  it('covers every markdown field of the schema, plus step payload', () => {
    for (const kind of kinds) {
      const markdown = Object.entries(propertiesOf(kind))
        .filter(([, property]) => isMarkdown(property))
        .map(([key]) => key);
      for (const key of markdown) expect(isTextField(kind, key), `${kind}.${key}`).toBe(true);
    }
    expect(isTextField('step', 'payload')).toBe(true);
  });

  it('names only properties the schema has', () => {
    for (const kind of kinds) {
      for (const key of TEXT_FIELDS[kind]) {
        expect(Object.hasOwn(propertiesOf(kind), key), `${kind}.${key}`).toBe(true);
      }
    }
  });

  it('keeps database notes plain text, never Y.Text (040)', () => {
    for (const kind of ['dbColumn', 'dbIndex', 'dbCheck', 'enum', 'enumValue'] as const) {
      expect(TEXT_FIELDS[kind]).toEqual([]);
    }
    expect(isTextField('dbColumn', 'note')).toBe(false);
    expect(isTextField('enumValue', 'note')).toBe(false);
  });

  it('answers false for short fields', () => {
    expect(isTextField('nodes', 'title')).toBe(false);
    expect(isTextField('stickies', 'text')).toBe(true);
  });
});
