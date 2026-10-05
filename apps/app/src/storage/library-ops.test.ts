// @vitest-environment node
import { createEditor, fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import full from '@sododeck/schema/examples/full.sododeck.json' with { type: 'json' };
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { generateBenchDeck } from '../bench/generate-deck';
import { legacyDeckBytes } from '../test/legacy-deck';
import {
  create,
  duplicate,
  exportDeck,
  importFile,
  importMermaid,
  LibraryOpError,
  rename,
} from './library-ops';

const docOf = (updates: Uint8Array[]) => {
  const doc = new Y.Doc();
  for (const u of updates) Y.applyUpdate(doc, u);
  return doc;
};

describe('library ops', () => {
  it('refuses to read a deck stored by a build before 036 (FR-027)', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof LibraryOpError ? error.code : 'other';
      }
      return 'none';
    };
    const legacy = [legacyDeckBytes()];
    expect(code(() => exportDeck(legacy))).toBe('unsupported-deck');
    expect(code(() => rename(legacy, 'New name'))).toBe('unsupported-deck');
    expect(code(() => duplicate(legacy, 'Copy'))).toBe('unsupported-deck');
  });

  it('creates an empty named deck', () => {
    const { bytes, summary } = create('Untitled deck');
    // A new deck starts with every pack on (030); an imported file keeps what it has.
    expect(toJSON(docOf([bytes]))).toEqual({
      ...emptySododeckFile(),
      name: 'Untitled deck',
      packs: ['architecture', 'process', 'data', 'database', 'shapes'],
    });
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

  it('keeps every icon value as written through import and export (038 T041)', () => {
    const icons = ['lucide:server', 'server', 'Server', 'simple:kafka', 'mdi:database', 'a b'];
    const file = {
      ...emptySododeckFile(),
      name: 'Icons',
      nodes: icons.map((icon, index) => ({
        id: `n${String(index)}`,
        type: 'service',
        title: `Node ${String(index)}`,
        icon,
        position: { x: index * 200, y: 0 },
      })),
    };
    const text = serializeDeck(file);
    const exported = exportDeck([importFile(text).bytes]);
    expect(exported.json).toBe(text);
    const back = JSON.parse(exported.json) as SododeckFile;
    expect(back.nodes.map((n) => n.icon)).toEqual(icons);
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

describe('library ops keep card size and connector route (017 US4)', () => {
  it('keeps size and route unchanged when importing, editing a title and exporting', () => {
    const file = { ...(full as SododeckFile), name: 'Full' };
    const text = serializeDeck(file);
    const { bytes } = importFile(text);
    const doc = docOf([bytes]);
    const before = Y.encodeStateVector(doc);
    const editor = createEditor(doc);
    const node = toJSON(doc).nodes[0];
    if (node === undefined) throw new Error('fixture has no nodes');
    editor.update('nodes', node.id, { title: `${node.title} v2` });
    editor.destroy();
    const delta = Y.encodeStateAsUpdate(doc, before);
    const exported = exportDeck([bytes, delta]);
    const exportedFile = JSON.parse(exported.json) as SododeckFile;
    expect(exportedFile.nodes.find((n) => n.id === node.id)?.title).toBe(`${node.title} v2`);
    expect(exportedFile.nodes.map((n) => n.size)).toEqual(file.nodes.map((n) => n.size));
    expect(exportedFile.edges.map((e) => e.route)).toEqual(file.edges.map((e) => e.route));
  });

  it('has neither field when importing and exporting a deck without them', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      name: 'Bare',
      nodes: [{ id: 'a', type: 'service', title: 'A' }],
    };
    const text = serializeDeck(file);
    const { bytes } = importFile(text);
    const doc = docOf([bytes]);
    const before = Y.encodeStateVector(doc);
    const editor = createEditor(doc);
    editor.update('nodes', 'a', { title: 'A2' });
    editor.destroy();
    const delta = Y.encodeStateAsUpdate(doc, before);
    const exported = exportDeck([bytes, delta]);
    const exportedFile = JSON.parse(exported.json) as SododeckFile;
    expect(exportedFile.nodes[0]?.size).toBeUndefined();
  });

  it('imports an out-of-range size without an error', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      name: 'Oversized',
      nodes: [{ id: 'a', type: 'service', title: 'A', size: { width: 900, height: 40 } }],
    };
    const text = serializeDeck(file);
    const { bytes, summary } = importFile(text);
    expect(summary.nodeCount).toBe(1);
    expect(toJSON(docOf([bytes])).nodes[0]?.size).toEqual({ width: 900, height: 40 });
  });
});

describe('importMermaid', () => {
  it('reads a flowchart without positions and says which way it runs', () => {
    const { file, report, direction } = importMermaid('flowchart LR\nA[Web] --> B{ok?}');
    expect(direction).toBe('LR');
    expect(file.nodes.map((n) => n.position)).toEqual([undefined, undefined]);
    expect(report).toMatchObject({ kind: 'flowchart', counts: { components: 2, connections: 1 } });
  });

  it('reads a sequence diagram already placed', () => {
    const { file, report, direction } = importMermaid('sequenceDiagram\nA->>B: hi');
    expect(direction).toBeNull();
    expect(file.nodes.every((n) => n.position !== undefined)).toBe(true);
    expect(report.counts.steps).toBe(1);
  });

  it('gives a file the ordinary import accepts', () => {
    const { file } = importMermaid('sequenceDiagram\nA->>B: hi');
    expect(importFile(JSON.stringify(file)).summary.nodeCount).toBe(2);
  });

  it.each([
    ['', 'mermaid-empty', ''],
    ['erDiagram\nA ||--o{ B : x', 'mermaid-unsupported-type', 'erDiagram'],
    ['what\nis this', 'mermaid-nothing-readable', 'line 1: what'],
    ['flowchart LR\n???', 'mermaid-nothing-readable', 'line 2: ???'],
  ])('refuses %j with %s', (text, code, message) => {
    try {
      importMermaid(text);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(LibraryOpError);
      expect(error).toMatchObject({ code, message });
    }
  });
});
