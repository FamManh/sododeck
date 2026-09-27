import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  COLLECTIONS,
  serializeDeck,
  serializeEntries,
  serializeEntry,
  type EntryCollection,
} from '../src';
import { canonicalize } from '../src/key-order';
import { readExample } from './helpers';

const fixtures: [string, SododeckFile][] = [
  ['minimal', await readExample('minimal.sododeck.json')],
  ['flow-and-rule', await readExample('flow-and-rule.sododeck.json')],
  ['full', await readExample('full.sododeck.json')],
];

/**
 * Cuts the text of every entry of one top-level field out of the file text: the lines of each
 * item (array) or value (`rules` map) at the file's 4-space nesting, dedented, without the
 * trailing comma and without the map key.
 */
function fileSlices(text: string, field: EntryCollection): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`  "${field}": `));
  if (start === -1) return [];
  const slices: string[] = [];
  let current: string[] | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('  ]') || line.startsWith('  }')) break;
    if (current === null) {
      // Opening line of an entry: `    {` (array) or `    "R-1": {` (rules map).
      current = [line.replace(/^ {4}("[^"]*": )?/, '')];
    } else if (/^ {4}\},?$/.test(line)) {
      current.push('}');
      slices.push(current.join('\n'));
      current = null;
    } else {
      current.push(line.slice(4));
    }
  }
  return slices;
}

function entriesOf(file: SododeckFile, field: EntryCollection): unknown[] {
  return field === 'rules' ? Object.values(file.rules) : file[field];
}

describe('serializeEntry', () => {
  for (const [name, file] of fixtures) {
    const text = serializeDeck(file);
    for (const field of [...COLLECTIONS, 'rules'] as const) {
      const entries = entriesOf(file, field);
      if (entries.length === 0) continue;
      it(`equals each ${field} entry's slice of the ${name} file`, () => {
        expect(entries.map((entry) => serializeEntry(field, entry))).toEqual(
          fileSlices(text, field),
        );
      });
    }
  }

  it('covers every collection and rules across the fixtures', () => {
    const covered = new Set(
      fixtures.flatMap(([, file]) =>
        [...COLLECTIONS, 'rules' as const].filter((f) => entriesOf(file, f).length > 0),
      ),
    );
    expect([...covered].sort()).toEqual([...COLLECTIONS, 'rules'].sort());
  });

  it('writes keys in canonical order whatever order the value has', () => {
    const shuffled = {
      position: { y: 2, x: 1 },
      tags: ['a'],
      title: 'Orders',
      type: 'service',
      id: 'n1',
    };
    expect(serializeEntry('nodes', shuffled)).toBe(
      JSON.stringify(
        { id: 'n1', type: 'service', title: 'Orders', tags: ['a'], position: { x: 1, y: 2 } },
        null,
        2,
      ),
    );
  });
});

describe('serializeEntries', () => {
  it('is "[]" for no entries', () => {
    expect(serializeEntries([])).toBe('[]');
  });

  it('is a JSON array of canonical entries, without a trailing newline', () => {
    const a = { title: 'A', id: 'a', type: 'service' };
    const b = { id: 'b', title: 'B', type: 'database' };
    const e = { to: 'b', from: 'a', id: 'e' };
    const text = serializeEntries([
      { collection: 'nodes', value: a },
      { collection: 'nodes', value: b },
      { collection: 'edges', value: e },
    ]);
    const canonical = canonicalize({ nodes: [a, b], edges: [e] });
    expect(text).toBe(JSON.stringify([...canonical.nodes, ...canonical.edges], null, 2));
    expect(text.endsWith('\n')).toBe(false);
  });
});
