import { describe, expect, it } from 'vitest';

import { READABLE_FIELDS, READABLE_IGNORED } from '../src/markdown-form';
import { TEXT_FIELDS, type TextKind } from '../src/text-fields';

describe('the readable part follows the schema', () => {
  it('covers every long-text field or says why not', () => {
    const covered = new Set(
      READABLE_FIELDS.flatMap((k) => k.bodies.map((b) => `${k.textKind}.${b.field}`)),
    );
    const ignored = new Set(READABLE_IGNORED.map((i) => `${i.textKind}.${i.field}`));
    for (const i of READABLE_IGNORED) expect(i.reason.length).toBeGreaterThan(10);
    const missing: string[] = [];
    for (const [kind, fields] of Object.entries(TEXT_FIELDS) as [TextKind, readonly string[]][]) {
      for (const field of fields) {
        const key = `${kind}.${field}`;
        if (!covered.has(key) && !ignored.has(key)) missing.push(key);
      }
    }
    expect(
      missing,
      'add these to READABLE_FIELDS or READABLE_IGNORED (src/markdown-form.ts)',
    ).toEqual([]);
  });

  it('lists only fields that exist as long text', () => {
    for (const kind of READABLE_FIELDS) {
      for (const body of kind.bodies) {
        expect(TEXT_FIELDS[kind.textKind as TextKind], kind.textKind).toContain(body.field);
      }
    }
  });
});
