// @vitest-environment node
import { fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { generateBenchDeck } from '../bench/generate-deck';
import { create, duplicate, exportDeck, importFile, LibraryOpError, rename } from './library-ops';

const docOf = (updates: Uint8Array[]) => {
  const doc = new Y.Doc();
  for (const u of updates) Y.applyUpdate(doc, u);
  return doc;
};

describe('library ops', () => {
  it('creates an empty named deck', () => {
    const { bytes, summary } = create('Untitled deck');
    expect(toJSON(docOf([bytes]))).toEqual({ ...emptySododeckFile(), name: 'Untitled deck' });
    expect(summary).toMatchObject({ name: 'Untitled deck', nodeCount: 0, thumb: null });
  });

  it('imports and exports the bench deck without loss', () => {
    const file = { ...generateBenchDeck(500, 1000).deck, name: 'Bench' };
    const text = serializeDeck(file);
    const imported = importFile(text);
    expect(imported.summary).toMatchObject({ name: 'Bench', nodeCount: 500, edgeCount: 1000 });
    const exported = exportDeck([imported.bytes]);
    expect(exported).toEqual({ json: text, name: 'Bench' });
  });

  it('names a nameless import "Imported deck"', () => {
    const { bytes, summary } = importFile(serializeDeck(emptySododeckFile()));
    expect(summary.name).toBe('Imported deck');
    expect(toJSON(docOf([bytes])).name).toBe('Imported deck');
  });

  it('refuses invalid files with a typed error', () => {
    const code = (text: string) => {
      try {
        importFile(text);
      } catch (error) {
        return error instanceof LibraryOpError ? error.code : 'other';
      }
      return 'none';
    };
    expect(code('not json')).toBe('invalid-json');
    expect(code('{"nodes": 3}')).toBe('invalid-deck');
    expect(code('[]')).toBe('invalid-deck');
    expect(code(JSON.stringify({ ...emptySododeckFile(), version: 2 }))).toBe(
      'unsupported-version',
    );
  });

  it('renames with a delta that applies to the stored deck', () => {
    const { bytes } = create('Old');
    const { delta, summary } = rename([bytes], '  New name ');
    expect(summary.name).toBe('New name');
    expect(toJSON(docOf([bytes, delta])).name).toBe('New name');
    expect(() => rename([bytes], '   ')).toThrow(LibraryOpError);
  });

  it('duplicates into an independent deck with only the name changed', () => {
    const source = fromJSON({
      ...emptySododeckFile(),
      name: 'Shop',
      nodes: [{ id: 'a', type: 'service', title: 'A' }],
    });
    const original = Y.encodeStateAsUpdate(source);
    const { bytes, summary } = duplicate([original], 'Shop copy');
    expect(summary).toMatchObject({ name: 'Shop copy', nodeCount: 1 });
    const copy = docOf([bytes]);
    expect({ ...toJSON(copy), name: 'Shop' }).toEqual(toJSON(source));

    // A fresh history, not a copy of the original's: the two logs never share updates.
    expect(Y.decodeStateVector(Y.encodeStateVector(copy)).has(source.clientID)).toBe(false);
  });
});
