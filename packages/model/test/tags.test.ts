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
