import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ArrowLeftRight,
  Box,
  Cloud,
  Database,
  Diamond,
  FileText,
  MonitorSmartphone,
  Puzzle,
  Router,
  Shapes,
  SquareCheck,
  Ticket,
  Truck,
  Warehouse,
} from 'lucide-react';

import {
  MATERIAL_GLYPHS,
  MATERIAL_TO_LUCIDE,
  TYPE_FALLBACK,
  TYPE_STYLE,
  typeStyle,
} from '../src/lib/icons';

const mappingDoc = readFileSync(
  resolve(import.meta.dirname, '../../../docs/design/icon-mapping.md'),
  'utf8',
);

const TYPE_IDS = [
  'service',
  'database',
  'gateway',
  'client',
  'queue',
  'external',
  'component',
  'task',
  'decision',
  'document',
  'warehouse',
  'truck-route',
  'issue',
] as const;

describe('card type styles (030)', () => {
  it('has the 13 built-in ids', () => {
    expect(Object.keys(TYPE_STYLE).sort()).toEqual([...TYPE_IDS].sort());
  });

  it.each(TYPE_IDS)('%s has an icon and a soft/ink tone', (id) => {
    const style = typeStyle(id);
    expect(style.icon).toBeDefined();
    expect(style.tone).toMatch(/^bg-\S+ text-\S+$/);
  });

  it('keeps today’s icon and tone for the six legacy types', () => {
    expect(TYPE_STYLE.client).toEqual({
      icon: MonitorSmartphone,
      tone: 'bg-surface-2 text-ink-secondary',
    });
    expect(TYPE_STYLE.gateway).toEqual({ icon: Router, tone: 'bg-inverse text-on-inverse' });
    expect(TYPE_STYLE.service).toEqual({ icon: Box, tone: 'bg-primary-soft text-primary-ink' });
    expect(TYPE_STYLE.queue).toEqual({
      icon: ArrowLeftRight,
      tone: 'bg-amber-soft text-amber-ink',
    });
    expect(TYPE_STYLE.database).toEqual({ icon: Database, tone: 'bg-blue-soft text-blue-ink' });
    expect(TYPE_STYLE.external).toEqual({ icon: Cloud, tone: 'bg-clay-soft text-clay-ink' });
  });

  it('gives the new types the icons of research R3', () => {
    expect(typeStyle('component').icon).toBe(Puzzle);
    expect(typeStyle('task').icon).toBe(SquareCheck);
    expect(typeStyle('decision').icon).toBe(Diamond);
    expect(typeStyle('document').icon).toBe(FileText);
    expect(typeStyle('warehouse').icon).toBe(Warehouse);
    expect(typeStyle('truck-route').icon).toBe(Truck);
    expect(typeStyle('issue').icon).toBe(Ticket);
  });

  it('has a neutral fallback with the Shapes icon', () => {
    expect(TYPE_FALLBACK.icon).toBe(Shapes);
    expect(TYPE_FALLBACK.tone).toBe('bg-surface-2 text-ink-secondary');
  });
});

describe('typeStyle', () => {
  it.each([
    ['Database', 'database'],
    [' queue ', 'queue'],
    ['edge', 'gateway'],
    ['data', 'database'],
    ['EXTERNAL', 'external'],
    ['Truck-Route', 'truck-route'],
  ] as const)('maps %j to the %s style', (input, id) => {
    expect(typeStyle(input)).toBe(TYPE_STYLE[id]);
  });

  it.each(['nope', '', 'robot'])('falls back for %j', (input) => {
    expect(typeStyle(input)).toBe(TYPE_FALLBACK);
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
