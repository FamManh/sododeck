import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, DeckEditError, fromJSON, MAX_SWATCHES, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

function setup(file: SododeckFile = emptySododeckFile()) {
  const doc = fromJSON(file);
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

describe('addSwatch (020, R3)', () => {
  it('normalizes case and adds a leading #, as one undo step', () => {
    const { doc, editor } = setup();
    editor.addSwatch('ABCDEF');
    expect(toJSON(doc).swatches).toEqual(['#abcdef']);
    editor.undo();
    expect(toJSON(doc).swatches).toBeUndefined();
    expectValid(doc);
  });

  it('is a no-op on an exact duplicate (after normalizing)', () => {
    const { doc, editor } = setup();
    editor.addSwatch('#7a3cff');
    editor.addSwatch('7A3CFF');
    expect(toJSON(doc).swatches).toEqual(['#7a3cff']);
  });

  it(`throws invalid at the ${String(MAX_SWATCHES)}-colour cap, writing nothing`, () => {
    const { doc, editor } = setup();
    for (let i = 0; i < MAX_SWATCHES; i++) {
      editor.addSwatch(`#${(i + 1).toString(16).padStart(6, '0')}`);
    }
    const before = toJSON(doc);
    expect(
      codeOf(() => {
        editor.addSwatch('#ffffff');
      }),
    ).toBe('invalid');
    expect(toJSON(doc)).toEqual(before);
  });

  it('throws invalid for a malformed hex value', () => {
    expect(
      codeOf(() => {
        setup().editor.addSwatch('not-a-colour');
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        setup().editor.addSwatch('#abc');
      }),
    ).toBe('invalid');
  });

  it('merges concurrent adds of different colours from two synced docs', () => {
    const { doc, editor } = setup();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const otherEditor = createEditor(other, { newId: seqIds() });

    editor.addSwatch('#111111');
    otherEditor.addSwatch('#222222');

    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc, Y.encodeStateVector(other)));
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(toJSON(doc).swatches).toEqual(expect.arrayContaining(['#111111', '#222222']));
    expect(toJSON(doc)).toEqual(toJSON(other));
  });
});

describe('removeSwatch (020, R3)', () => {
  it('removes a stored colour, and never touches node or group styles', () => {
    const { doc, editor } = setup({
      ...emptySododeckFile(),
      swatches: ['#7a3cff', '#1f2a44'],
      nodes: [{ id: 'a', type: 'client', title: 'A', style: { fill: '#7a3cff' } }],
    });
    editor.removeSwatch('#7a3cff');
    expect(toJSON(doc).swatches).toEqual(['#1f2a44']);
    expect(toJSON(doc).nodes[0]?.style).toEqual({ fill: '#7a3cff' });
    expectValid(doc);
  });

  it('does nothing when the colour is absent', () => {
    const { doc, editor } = setup({ ...emptySododeckFile(), swatches: ['#7a3cff'] });
    const before = toJSON(doc);
    editor.removeSwatch('#000000');
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('loads and lets a file with more than the 12-colour cap keep every swatch', () => {
    const swatches = Array.from(
      { length: 14 },
      (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`,
    );
    const { doc, editor } = setup({ ...emptySododeckFile(), swatches });
    expect(toJSON(doc).swatches).toEqual(swatches);
    editor.removeSwatch(swatches[0] ?? '');
    expect(toJSON(doc).swatches).toHaveLength(13);
    expectValid(doc);
  });
});
