import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  createEditor,
  DeckEditError,
  fromJSON,
  observeDeck,
  sameTag,
  serializeDeck,
  tagKey,
  toJSON,
} from '../src';
import { tagColorsMap } from '../src/layout';
import { expectValid, reload, seqIds } from './helpers';

function setup(file: Partial<SododeckFile> = {}) {
  const doc = fromJSON({ ...emptySododeckFile(), ...file });
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return null;
};

describe('tagKey (033, ADR 0022)', () => {
  it.each([
    ['PCI', 'pci'],
    ['  pci  ', 'pci'],
    ['Pci   DSS', 'pci dss'],
    ['a\tb', 'a b'],
    ['Crème', 'crème'],
    ['É', 'é'],
    ['x', 'x'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (input, key) => {
    expect(tagKey(input)).toBe(key);
  });

  it('does not fold accents', () => {
    expect(tagKey('cafe')).not.toBe(tagKey('café'));
  });
});

describe('sameTag', () => {
  it('is true for spellings with the same key and false otherwise', () => {
    expect(sameTag('PCI', 'pci')).toBe(true);
    expect(sameTag(' Pci  dss', 'PCI DSS ')).toBe(true);
    expect(sameTag('pci', 'pci-dss')).toBe(false);
    expect(sameTag('', '  ')).toBe(true);
  });
});

describe('setTagColor (033)', () => {
  it('sets a named colour and a hex, each as one undo step', () => {
    const { doc, editor } = setup();
    editor.setTagColor('pci', 'violet');
    expect(toJSON(doc).tagColors).toEqual({ pci: 'violet' });
    editor.setTagColor('lan', '#7a3cff');
    expect(toJSON(doc).tagColors).toEqual({ pci: 'violet', lan: '#7a3cff' });
    editor.undo();
    expect(toJSON(doc).tagColors).toEqual({ pci: 'violet' });
    editor.undo();
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
    editor.redo();
    expect(toJSON(doc).tagColors).toEqual({ pci: 'violet' });
    expectValid(doc);
  });

  it('replaces the colour of a tag that has one', () => {
    const { doc, editor } = setup({ tagColors: { PCI: 'violet' } });
    editor.setTagColor('PCI', 'red');
    expect(toJSON(doc).tagColors).toEqual({ PCI: 'red' });
  });

  it('keeps the existing spelling of the key', () => {
    const { doc, editor } = setup({ tagColors: { PIC: 'violet' } });
    editor.setTagColor('pic', 'red');
    editor.setTagColor('  Pic ', 'blue');
    expect(toJSON(doc).tagColors).toEqual({ PIC: 'blue' });
  });

  it('writes a new key trimmed and single-spaced, in the case given', () => {
    const { doc, editor } = setup();
    editor.setTagColor('  Zone   A ', 'teal');
    expect(toJSON(doc).tagColors).toEqual({ 'Zone A': 'teal' });
  });

  it('removes the entry with null, dropping tagColors when it was the last', () => {
    const { doc, editor } = setup({ tagColors: { PCI: 'violet', Lan: 'red' } });
    editor.setTagColor('pci', null);
    expect(toJSON(doc).tagColors).toEqual({ Lan: 'red' });
    editor.setTagColor('LAN', null);
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
    editor.undo();
    expect(toJSON(doc).tagColors).toEqual({ Lan: 'red' });
  });

  it('is a no-op, with no change event, for null on an absent tag and for the same colour', () => {
    const { doc, editor } = setup({ tagColors: { PCI: 'violet' } });
    let changes = 0;
    observeDeck(doc, () => {
      changes += 1;
    });
    editor.setTagColor('absent', null);
    editor.setTagColor('pci', 'violet');
    expect(changes).toBe(0);
    expect(editor.canUndo()).toBe(false);
  });

  it('reports one change on the meta scope, naming tagColors', () => {
    const { doc, editor } = setup();
    const seen: string[] = [];
    observeDeck(doc, ({ changes }) => {
      for (const change of changes)
        seen.push(`${change.scope}:${change.kind}:${change.keys.join()}`);
    });
    editor.setTagColor('pci', 'violet');
    expect(seen).toEqual(['meta:updated:tagColors']);
  });

  it.each(['purple', '#7A3CFF', '#abc', '', 'Violet'])(
    'throws invalid for the colour %j, writing nothing',
    (colour) => {
      const { doc, editor } = setup();
      const before = toJSON(doc);
      expect(
        codeOf(() => {
          editor.setTagColor('pci', colour);
        }),
      ).toBe('invalid');
      expect(toJSON(doc)).toEqual(before);
      expect(editor.canUndo()).toBe(false);
    },
  );

  it('throws invalid for an empty tag', () => {
    const { editor } = setup();
    expect(
      codeOf(() => {
        editor.setTagColor('   ', 'red');
      }),
    ).toBe('invalid');
  });

  it('colours a tag with no card: the entry stays until it is removed', () => {
    const { doc, editor } = setup();
    editor.setTagColor('orphan', 'blue');
    expect(toJSON(doc).nodes).toEqual([]);
    expect(toJSON(doc).tagColors).toEqual({ orphan: 'blue' });
  });

  it('round-trips through toJSON and fromJSON', () => {
    const { doc, editor } = setup();
    editor.setTagColor('PCI', 'violet');
    editor.setTagColor('Lan', '#7a3cff');
    const file = toJSON(doc);
    expect(toJSON(fromJSON(file))).toEqual(file);
    expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
  });

  it('attaches the map on the first write of a stored document that predates it (R2)', () => {
    const { doc } = setup();
    doc.getMap('meta').delete('tagColors');
    const stored = reload(doc);
    expect(toJSON(stored)).not.toHaveProperty('tagColors');
    expect(tagColorsMap(stored).doc).toBeNull();
    const editor = createEditor(stored, { newId: seqIds() });
    editor.setTagColor('pci', 'violet');
    expect(tagColorsMap(stored).doc).toBe(stored);
    expect(toJSON(stored).tagColors).toEqual({ pci: 'violet' });
    expect(toJSON(reload(stored)).tagColors).toEqual({ pci: 'violet' });
    expect(stored.getMap('meta').get('tagColors')).toBeInstanceOf(Y.Map);
  });

  it('merges two tabs colouring different tags without loss', () => {
    const { doc, editor } = setup();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const otherEditor = createEditor(other, { newId: seqIds() });

    editor.setTagColor('pci', 'violet');
    otherEditor.setTagColor('lan', 'red');

    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc, Y.encodeStateVector(other)));
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(toJSON(doc).tagColors).toEqual({ pci: 'violet', lan: 'red' });
    expect(toJSON(other)).toEqual(toJSON(doc));
  });
});

/** A deck with the tag "pci" (and its spellings) on every kind of carrier. */
function taggedDeck(): SododeckFile {
  return {
    ...emptySododeckFile(),
    tags: ['PCI', 'deck'],
    tagColors: { PCI: 'violet', Lan: 'red' },
    nodes: [
      { id: 'a', type: 'service', title: 'A', tags: ['PCI', 'lan'] },
      { id: 'b', type: 'service', title: 'B', tags: ['pci', 'PIC', 'x'] },
      { id: 'c', type: 'service', title: 'C', tags: ['pic'] },
      { id: 'd', type: 'service', title: 'D' },
    ],
    edges: [{ id: 'e', from: 'a', to: 'b', tags: ['Pci', 'other'] }],
    flows: [
      {
        id: 'f',
        title: 'F',
        tags: ['pci'],
        steps: [
          { id: 's1', edge: 'e', tags: ['PCI'] },
          { id: 's2', edge: 'e', tags: ['PCI', 'pci'] },
        ],
      },
    ],
    views: [
      { id: 'v1', type: 'custom', title: 'V1', excludeTags: ['pci', 'lan'] },
      { id: 'v2', type: 'custom', title: 'V2', excludeTags: ['PCI'] },
      { id: 'v3', type: 'custom', title: 'V3' },
    ],
  };
}

describe('renameTag (033)', () => {
  it('rewrites cards, connections, flows, steps, deck tags and view filters, and moves the colour', () => {
    const { doc, editor } = setup(taggedDeck());
    const change = editor.renameTag('pci', 'PCI-DSS');
    const file = toJSON(doc);
    expect(file.nodes.map((n) => n.tags)).toEqual([
      ['PCI-DSS', 'lan'],
      ['PCI-DSS', 'PIC', 'x'],
      ['pic'],
      undefined,
    ]);
    expect(file.edges[0]?.tags).toEqual(['PCI-DSS', 'other']);
    expect(file.flows[0]?.tags).toEqual(['PCI-DSS']);
    expect(file.flows[0]?.steps.map((s) => s.tags)).toEqual([['PCI-DSS'], ['PCI-DSS']]);
    expect(file.tags).toEqual(['PCI-DSS', 'deck']);
    expect(file.views.map((v) => v.excludeTags)).toEqual([
      ['PCI-DSS', 'lan'],
      ['PCI-DSS'],
      undefined,
    ]);
    expect(file.tagColors).toEqual({ 'PCI-DSS': 'violet', Lan: 'red' });
    expect(change).toEqual({ cards: 2, others: 7, notes: 0 });
    expectValid(doc);
  });

  it('is one undo step that restores the whole document', () => {
    const { doc, editor } = setup(taggedDeck());
    const before = toJSON(doc);
    editor.renameTag('pci', 'PCI-DSS');
    editor.undo();
    expect(toJSON(doc)).toEqual(before);
    expect(serializeDeck(toJSON(doc))).toBe(serializeDeck(before));
    editor.redo();
    expect(toJSON(doc).tagColors).toEqual({ 'PCI-DSS': 'violet', Lan: 'red' });
  });

  it('respells without merging when only the case changes', () => {
    const { doc, editor } = setup(taggedDeck());
    editor.renameTag('pci', 'Pci');
    const file = toJSON(doc);
    expect(file.nodes[0]?.tags).toEqual(['Pci', 'lan']);
    expect(file.nodes[1]?.tags).toEqual(['Pci', 'PIC', 'x']);
    expect(file.tagColors).toEqual({ Pci: 'violet', Lan: 'red' });
    expect(file.flows[0]?.steps[1]?.tags).toEqual(['Pci']);
  });

  it('merges onto an existing tag: its spelling and colour win, repeats are dropped, no card gains tags', () => {
    const { doc, editor } = setup(taggedDeck());
    const before = toJSON(doc);
    editor.renameTag('pci', 'pic');
    const file = toJSON(doc);
    // "PIC" is the first spelling of key pic in deck order; the existing key wins, "PCI" colour goes.
    expect(file.nodes[0]?.tags).toEqual(['PIC', 'lan']);
    expect(file.nodes[1]?.tags).toEqual(['PIC', 'x']);
    expect(file.nodes[2]?.tags).toEqual(['PIC']);
    expect(file.flows[0]?.steps[1]?.tags).toEqual(['PIC']);
    expect(file.views[0]?.excludeTags).toEqual(['PIC', 'lan']);
    expect(file.tagColors).toEqual({ Lan: 'red' });
    for (const [i, node] of file.nodes.entries()) {
      expect((node.tags ?? []).length).toBeLessThanOrEqual((before.nodes[i]?.tags ?? []).length);
    }
    editor.undo();
    expect(toJSON(doc)).toEqual(before);
  });

  it('keeps the colour of the tag it merges onto', () => {
    const { doc, editor } = setup({ ...taggedDeck(), tagColors: { PCI: 'violet', PIC: 'blue' } });
    editor.renameTag('pci', 'pic');
    expect(toJSON(doc).tagColors).toEqual({ PIC: 'blue' });
  });

  it('is a no-op, with no change event, for an unknown tag renamed to itself or nothing to change', () => {
    const { doc, editor } = setup({
      ...emptySododeckFile(),
      tagColors: { PCI: 'violet' },
      nodes: [{ id: 'a', type: 'service', title: 'A', tags: ['PCI'] }],
    });
    let events = 0;
    observeDeck(doc, () => {
      events += 1;
    });
    expect(editor.renameTag('absent', 'absent')).toEqual({ cards: 0, others: 0, notes: 0 });
    expect(editor.renameTag('PCI', 'PCI')).toEqual({ cards: 0, others: 0, notes: 0 });
    expect(editor.renameTag('pci', 'PCI')).toEqual({ cards: 0, others: 0, notes: 0 });
    expect(events).toBe(0);
    expect(editor.canUndo()).toBe(false);
  });

  it('throws invalid for an empty target, writing nothing', () => {
    const { doc, editor } = setup(taggedDeck());
    const before = toJSON(doc);
    expect(codeOf(() => editor.renameTag('pci', '   '))).toBe('invalid');
    expect(toJSON(doc)).toEqual(before);
  });

  it('renames a coloured tag no card carries', () => {
    const { doc, editor } = setup({ ...emptySododeckFile(), tagColors: { Orphan: 'blue' } });
    editor.renameTag('orphan', 'Lone');
    expect(toJSON(doc).tagColors).toEqual({ Lone: 'blue' });
  });
});

describe('deleteTag (033)', () => {
  it('removes the tag from every carrier and view filter, drops emptied lists and the colour', () => {
    const { doc, editor } = setup(taggedDeck());
    const change = editor.deleteTag('PCI');
    const file = toJSON(doc);
    expect(file.nodes.map((n) => n.tags)).toEqual([['lan'], ['PIC', 'x'], ['pic'], undefined]);
    expect(file.edges[0]?.tags).toEqual(['other']);
    expect(file.flows[0]).not.toHaveProperty('tags');
    expect(file.flows[0]?.steps.map((s) => s.tags)).toEqual([undefined, undefined]);
    expect(file.tags).toEqual(['deck']);
    expect(file.views.map((v) => v.excludeTags)).toEqual([['lan'], undefined, undefined]);
    expect(file.tagColors).toEqual({ Lan: 'red' });
    expect(change).toEqual({ cards: 2, others: 7, notes: 0 });
    expectValid(doc);
  });

  it('drops tagColors when its last entry goes, and one undo restores everything', () => {
    const { doc, editor } = setup({ ...taggedDeck(), tagColors: { PCI: 'violet' } });
    const before = toJSON(doc);
    editor.deleteTag('pci');
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
    editor.undo();
    expect(toJSON(doc)).toEqual(before);
  });

  it('deletes a coloured tag no card carries', () => {
    const { doc, editor } = setup({ ...emptySododeckFile(), tagColors: { Orphan: 'blue' } });
    expect(editor.deleteTag('orphan')).toEqual({ cards: 0, others: 0, notes: 0 });
    expect(toJSON(doc)).not.toHaveProperty('tagColors');
  });

  it('is a no-op for an absent tag, with zero counts and no change event', () => {
    const { doc, editor } = setup(taggedDeck());
    let events = 0;
    observeDeck(doc, () => {
      events += 1;
    });
    expect(editor.deleteTag('nothing')).toEqual({ cards: 0, others: 0, notes: 0 });
    expect(editor.deleteTag('')).toEqual({ cards: 0, others: 0, notes: 0 });
    expect(events).toBe(0);
    expect(editor.canUndo()).toBe(false);
  });
});

describe('tag ops on a large deck (033)', () => {
  const big: SododeckFile = {
    ...emptySododeckFile(),
    tagColors: { t3: 'red' },
    nodes: Array.from({ length: 500 }, (_, i) => ({
      id: `n${String(i)}`,
      type: 'service' as const,
      title: `N${String(i)}`,
      tags: [`t${String(i % 7)}`, `T${String(i % 5)}`, 'common'],
    })),
  };

  it.each([
    [
      'recolour',
      (e: ReturnType<typeof setup>['editor']) => {
        e.setTagColor('common', 'blue');
      },
    ],
    ['rename', (e: ReturnType<typeof setup>['editor']) => e.renameTag('common', 'shared')],
    ['delete', (e: ReturnType<typeof setup>['editor']) => e.deleteTag('common')],
  ])('%s on 500 cards takes under 100 ms', (_name, run) => {
    const { editor } = setup(big);
    const start = performance.now();
    run(editor);
    // Shared CI runners measured 2.5x over the local time, so they get a wider wall-clock budget.
    expect(performance.now() - start).toBeLessThan(process.env['CI'] ? 500 : 100);
  });
});

describe('sticky tags (053)', () => {
  const withNotes = (): SododeckFile => ({
    ...taggedDeck(),
    stickies: [
      { id: 'n1', text: 'one', position: { x: 0, y: 0 }, tags: ['PCI', 'Question'] },
      { id: 'n2', text: 'two', position: { x: 0, y: 0 }, tags: ['pci'] },
      { id: 'n3', text: 'three', position: { x: 0, y: 0 } },
    ],
  });

  it('setStickyTags keeps case, drops repeats ignoring case and spacing, and trims', () => {
    const { doc, editor } = setup(withNotes());
    editor.setStickyTags('n3', ['  Risk ', 'risk', 'Open  Q', 'open q', 'Done']);
    expect(toJSON(doc).stickies[2]?.tags).toEqual(['Risk', 'Open Q', 'Done']);
    expectValid(doc);
  });

  it('setStickyTags caps the list at 10', () => {
    const { doc, editor } = setup(withNotes());
    editor.setStickyTags(
      'n3',
      Array.from({ length: 14 }, (_, i) => `t${String(i)}`),
    );
    expect(toJSON(doc).stickies[2]?.tags).toEqual(
      Array.from({ length: 10 }, (_, i) => `t${String(i)}`),
    );
  });

  it('setStickyTags removes the key for an empty list, in one undo step', () => {
    const { doc, editor } = setup(withNotes());
    const before = toJSON(doc);
    editor.setStickyTags('n1', []);
    expect(toJSON(doc).stickies[0]).not.toHaveProperty('tags');
    editor.undo();
    expect(toJSON(doc)).toEqual(before);
  });

  it('setStickyTags refuses an unknown sticky and writes nothing when unchanged', () => {
    const { editor } = setup(withNotes());
    expect(
      codeOf(() => {
        editor.setStickyTags('nope', ['x']);
      }),
    ).toBe('not-found');
    editor.setStickyTags('n1', ['PCI', 'Question']);
    expect(editor.canUndo()).toBe(false);
  });

  it('renameTag reaches stickies in the same undo step and counts them', () => {
    const { doc, editor } = setup(withNotes());
    const before = toJSON(doc);
    const change = editor.renameTag('pci', 'PCI-DSS');
    const file = toJSON(doc);
    expect(file.stickies.map((s) => s.tags)).toEqual([
      ['PCI-DSS', 'Question'],
      ['PCI-DSS'],
      undefined,
    ]);
    expect(change).toEqual({ cards: 2, others: 7, notes: 2 });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('a tag only stickies carry can be renamed to merge onto a card tag', () => {
    const { doc, editor } = setup(withNotes());
    editor.renameTag('Question', 'lan');
    expect(toJSON(doc).stickies[0]?.tags).toEqual(['PCI', 'Lan']);
  });

  it('deleteTag removes it from stickies and drops emptied lists', () => {
    const { doc, editor } = setup(withNotes());
    const before = toJSON(doc);
    const change = editor.deleteTag('PCI');
    const file = toJSON(doc);
    expect(file.stickies.map((s) => s.tags)).toEqual([['Question'], undefined, undefined]);
    expect(file.stickies[1]).not.toHaveProperty('tags');
    expect(change.notes).toBe(2);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
  });

  it('a spelling first met on a sticky is used when another tag merges onto it', () => {
    const { doc, editor } = setup({
      ...emptySododeckFile(),
      nodes: [{ id: 'a', type: 'service', title: 'A', tags: ['x'] }],
      stickies: [{ id: 'n', text: 't', position: { x: 0, y: 0 }, tags: ['Question'] }],
    });
    editor.renameTag('x', 'question');
    expect(toJSON(doc).nodes[0]?.tags).toEqual(['Question']);
    expect(toJSON(doc).stickies[0]?.tags).toEqual(['Question']);
  });
});
