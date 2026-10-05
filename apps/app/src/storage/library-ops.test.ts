// @vitest-environment node
import { assetId, createEditor, fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import full from '@sododeck/schema/examples/full.sododeck.json' with { type: 'json' };
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { generateBenchDeck } from '../bench/generate-deck';
import { PNG_1X1 } from '../images/test-pictures';
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

  it('carries every problem of a refused file, sorted (062)', () => {
    const file = {
      ...emptySododeckFile(),
      nodes: [
        { id: 'a', type: 'service' },
        { id: 'a', type: 'service', title: 'A' },
      ],
    };
    try {
      importFile(JSON.stringify(file));
      expect.unreachable();
    } catch (error) {
      if (!(error instanceof LibraryOpError)) throw error;
      expect(error.code).toBe('invalid-deck');
      expect(error.report).toMatchObject({ status: 'refused', source: { name: 'deck file' } });
      expect(error.report?.problems.map((p) => [p.code, p.path])).toEqual([
        ['schema-required', '/nodes/0/title'],
        ['duplicate-id', '/nodes/1/id'],
      ]);
    }
    try {
      importFile('{ oops', 'broken.sododeck');
      expect.unreachable();
    } catch (error) {
      if (!(error instanceof LibraryOpError)) throw error;
      expect(error.report?.source.name).toBe('broken.sododeck');
      expect(error.report?.problems[0]).toMatchObject({ code: 'invalid-json', line: 1 });
    }
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

describe('library ops: pictures (055)', () => {
  const id = assetId(PNG_1X1);
  const deckWithImage = (): SododeckFile => {
    const doc = fromJSON(emptySododeckFile());
    createEditor(doc).addImages([
      {
        asset: id,
        meta: { type: 'image/png', bytes: PNG_1X1.length, width: 1, height: 1, name: 'dot.png' },
        position: { x: 0, y: 0 },
        size: { width: 64, height: 64 },
      },
    ]);
    return JSON.parse(serializeDeck(doc, new Map([[id, PNG_1X1]]))) as SododeckFile;
  };
  const withAsset = (patch: Record<string, unknown>) => {
    const file = deckWithImage();
    const assets = file.assets ?? {};
    return JSON.stringify({ ...file, assets: { [id]: { ...assets[id], ...patch } } });
  };

  /** The damaged pictures an import reports (062: they are entries of the opened report). */
  const damaged = (imported: ReturnType<typeof importFile>) =>
    imported.openReport?.problems.filter((p) => p.code === 'picture-damaged') ?? [];

  it('returns the pictures of an imported file with their stored type', () => {
    const imported = importFile(JSON.stringify(deckWithImage()));
    expect(damaged(imported)).toEqual([]);
    expect(imported.pictures).toHaveLength(1);
    expect(imported.pictures[0]).toMatchObject({ id, type: 'image/png' });
    expect([...(imported.pictures[0]?.bytes ?? [])]).toEqual([...PNG_1X1]);
  });

  it('opens a file whose picture data is wrong, listing it as a problem and storing nothing', () => {
    for (const patch of [{ data: 'AA==' }, { bytes: 5_242_881 }, { type: 'application/pdf' }]) {
      const imported = (() => {
        try {
          return importFile(withAsset(patch));
        } catch (error) {
          // A type outside the allow-list is a schema error, refused whole.
          return error instanceof LibraryOpError ? error.code : 'other';
        }
      })();
      if (typeof imported === 'string') {
        expect(imported).toBe('invalid-deck');
        continue;
      }
      expect(imported.pictures).toEqual([]);
      expect(damaged(imported)).toHaveLength(1);
      expect(imported.openReport).toMatchObject({ status: 'opened', counts: { warning: 1 } });
    }
  });

  it('opens a file with a picture missing from `assets` as invalid, not half loaded', () => {
    const file = deckWithImage();
    const { assets: _assets, ...rest } = file;
    expect(() => importFile(JSON.stringify(rest))).toThrow(LibraryOpError);
  });

  it('opens a file from before pictures unchanged and exports it without images or assets', () => {
    const plain = { ...emptySododeckFile(), name: 'Old' };
    const imported = importFile(JSON.stringify(plain));
    expect(imported.pictures).toEqual([]);
    expect(imported.openReport).toBeNull();
    const { json } = exportDeck([imported.bytes]);
    expect(json).not.toContain('"images"');
    expect(json).not.toContain('"assets"');
  });

  it('exports a deck with its pictures byte-identical to what was imported', () => {
    const first = importFile(JSON.stringify(deckWithImage()));
    const firstBytes = new Map(first.pictures.map((p) => [p.id, p.bytes]));
    const { json } = exportDeck([first.bytes], firstBytes);
    const second = importFile(json);
    const secondBytes = new Map(second.pictures.map((p) => [p.id, p.bytes]));
    expect(exportDeck([second.bytes], secondBytes).json).toBe(json);
    expect([...(secondBytes.get(id) ?? [])]).toEqual([...PNG_1X1]);
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
