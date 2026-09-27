import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COMPONENT_KINDS,
  KIND_FALLBACK,
  KIND_STYLE,
  MATERIAL_GLYPHS,
  MATERIAL_TO_LUCIDE,
  toComponentKind,
} from '../src/lib/icons';

const mappingDoc = readFileSync(
  resolve(import.meta.dirname, '../../../docs/design/icon-mapping.md'),
  'utf8',
);

describe('component kinds', () => {
  it('lists the six kinds in palette order', () => {
    expect(COMPONENT_KINDS).toEqual([
      'client',
      'gateway',
      'service',
      'queue',
      'database',
      'external',
    ]);
  });

  it.each(COMPONENT_KINDS)('%s has an icon, a label and a soft/ink tone', (kind) => {
    const style = KIND_STYLE[kind];
    expect(style.icon).toBeDefined();
    expect(style.label.length).toBeGreaterThan(0);
    expect(style.tone).toMatch(/^bg-\S+ text-\S+$/);
  });

  it('has a neutral fallback', () => {
    expect(KIND_FALLBACK.label).toBe('Component');
    expect(KIND_FALLBACK.icon).toBeDefined();
  });
});

describe('toComponentKind', () => {
  it.each([
    ['Database', 'database'],
    [' queue ', 'queue'],
    ['edge', 'gateway'],
    ['data', 'database'],
    ['EXTERNAL', 'external'],
  ])('maps %j to %s', (input, expected) => {
    expect(toComponentKind(input)).toBe(expected);
  });

  it.each(['nope', '', 'note'])('returns null for %j', (input) => {
    expect(toComponentKind(input)).toBeNull();
  });
});

describe('Material → lucide mapping (SC-007)', () => {
  it('maps every glyph used in the prototype', () => {
    for (const glyph of MATERIAL_GLYPHS) {
      expect(MATERIAL_TO_LUCIDE[glyph], glyph).toBeDefined();
    }
    expect(Object.keys(MATERIAL_TO_LUCIDE).sort()).toEqual([...MATERIAL_GLYPHS].sort());
  });

  it('explains every substitute', () => {
    for (const [glyph, entry] of Object.entries(MATERIAL_TO_LUCIDE)) {
      if (entry.substitute) expect(entry.note, glyph).toMatch(/\S/);
    }
  });

  it('is documented row for row in docs/design/icon-mapping.md', () => {
    const section = mappingDoc.split('## Glyphs')[1] ?? '';
    const documented = [...section.matchAll(/^\| `([a-z0-9_]+)` +\|/gm)].map((match) => match[1]);
    expect(documented.sort()).toEqual([...MATERIAL_GLYPHS].sort());
  });
});
