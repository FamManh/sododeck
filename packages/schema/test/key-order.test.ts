import { describe, expect, it } from 'vitest';

import { jsonSchema, type SododeckFile } from '../src';
import { examples, readExample, walk } from './schema-walk';

/**
 * The declaration order of `properties` in v1.json is the canonical key order (research R5), so
 * files written by the app diff cleanly in git. Examples must follow it.
 */
function keyOrderViolations(file: unknown): string[] {
  const violations: string[] = [];
  walk(file, {
    object(type, value, schema, path) {
      const order = Object.keys(schema.properties ?? {});
      const keys = Object.keys(value);
      const expected = [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      if (keys.join() !== expected.join()) {
        violations.push(
          `${path || '(root)'} (${type}): ${keys.join(', ')} → ${expected.join(', ')}`,
        );
      }
    },
  });
  return violations;
}

describe('canonical key order', () => {
  it.each(examples)('%s follows the schema key order', (_file, example) => {
    expect(keyOrderViolations(example)).toEqual([]);
  });

  it('declares tagColors right after swatches (033)', () => {
    const order = Object.keys(jsonSchema.properties);
    expect(order.indexOf('tagColors')).toBe(order.indexOf('swatches') + 1);
  });

  it('declares packs right after tagColors (030)', () => {
    const order = Object.keys(jsonSchema.properties);
    expect(order.indexOf('packs')).toBe(order.indexOf('tagColors') + 1);
  });

  it('detects keys out of order', () => {
    const file = { $schema: 'x', version: 1, nodes: [{ title: 'A', id: 'a', type: 'service' }] };
    expect(keyOrderViolations(file)).toEqual([
      '.nodes.0 (Node): title, id, type → id, type, title',
    ]);
  });

  it('renaming a node changes exactly one line and no id or reference', () => {
    const before = readExample('full.sododeck.json') as SododeckFile;
    const after = structuredClone(before);
    const node = after.nodes.find((candidate) => candidate.id === 'order-svc');
    if (node === undefined) throw new Error('order-svc missing from the full example');
    node.title = 'Orders API';

    const beforeLines = JSON.stringify(before, null, 2).split('\n');
    const afterLines = JSON.stringify(after, null, 2).split('\n');
    expect(afterLines).toHaveLength(beforeLines.length);
    const changed = afterLines.filter((line, index) => line !== beforeLines[index]);
    expect(changed).toEqual(['      "title": "Orders API",']);
  });
});
