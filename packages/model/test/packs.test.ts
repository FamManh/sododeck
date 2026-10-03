import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createDeck,
  createEditor,
  DeckEditError,
  fromJSON,
  NEW_DECK_PACKS,
  serializeDeck,
  toJSON,
} from '../src';
import { bothOrders } from './helpers';

const empty = emptySododeckFile();

function setup(file: Partial<SododeckFile> = {}) {
  const doc = fromJSON({ ...empty, ...file });
  return { doc, editor: createEditor(doc) };
}

describe('setPackOn (030)', () => {
  it('materialises architecture before the first change on a deck with no packs', () => {
    const { doc, editor } = setup();
    editor.setPackOn('process', true);
    expect(toJSON(doc).packs).toEqual(['architecture', 'process']);
  });

  it('turns a pack off and on again, one undo step each', () => {
    const { doc, editor } = setup({ packs: ['architecture', 'process'] });
    editor.setPackOn('process', false);
    expect(toJSON(doc).packs).toEqual(['architecture']);
    editor.setPackOn('process', true);
    expect(toJSON(doc).packs).toEqual(['architecture', 'process']);
    editor.undo();
    expect(toJSON(doc).packs).toEqual(['architecture']);
    editor.undo();
    expect(toJSON(doc).packs).toEqual(['architecture', 'process']);
  });

  it('writes nothing when the pack is already as asked', () => {
    const { doc, editor } = setup();
    editor.setPackOn('architecture', true);
    expect(toJSON(doc)).not.toHaveProperty('packs');
    expect(editor.canUndo()).toBe(false);
  });

  it('refuses to turn off the last pack on and writes nothing', () => {
    const { doc, editor } = setup({ packs: ['data'] });
    expect(() => {
      editor.setPackOn('data', false);
    }).toThrow(DeckEditError);
    expect(toJSON(doc).packs).toEqual(['data']);
    const legacy = setup();
    expect(() => {
      legacy.editor.setPackOn('architecture', false);
    }).toThrow(DeckEditError);
    expect(toJSON(legacy.doc)).not.toHaveProperty('packs');
  });

  it('refuses an invalid pack id', () => {
    const { doc, editor } = setup({ packs: ['architecture'] });
    expect(() => {
      editor.setPackOn('Bad Id', true);
    }).toThrow(DeckEditError);
    expect(toJSON(doc).packs).toEqual(['architecture']);
  });

  it('merges two tabs toggling different packs', () => {
    const file = { ...empty, packs: ['architecture'] };
    bothOrders(
      file,
      (a) => {
        a.editor.setPackOn('process', true);
      },
      (b) => {
        b.editor.setPackOn('logistics', true);
      },
      (a) => {
        expect(toJSON(a.doc).packs).toEqual(['architecture', 'process', 'logistics']);
      },
    );
  });
});

describe('packs in the document (030)', () => {
  it('createDeck() holds the four 030 packs', () => {
    expect(toJSON(createDeck()).packs).toEqual(NEW_DECK_PACKS);
  });

  it('a file without packs reads and writes byte-identical, with no packs key', () => {
    const file = { ...empty, nodes: [{ id: 'n', type: 'service', title: 'N' }] };
    const out = toJSON(fromJSON(file));
    expect(out).not.toHaveProperty('packs');
    expect(serializeDeck(out)).toBe(serializeDeck(file));
  });

  it('round-trips explicit packs, unknown pack ids and unknown type ids unchanged', () => {
    const file: SododeckFile = {
      ...empty,
      tagColors: { Lan: 'red' },
      packs: ['architecture', 'process', 'future-pack'],
      nodes: [
        { id: 'n1', type: 'robot', title: 'Robot' },
        { id: 'n2', type: 'warehouse', title: 'Hub' },
      ],
    };
    const out = toJSON(fromJSON(file));
    expect(out).toEqual(file);
    const keys = Object.keys(out);
    expect(keys.indexOf('packs')).toBe(keys.indexOf('tagColors') + 1);
  });

  it('emits packs in registry order, then unknown ids sorted', () => {
    const out = toJSON(fromJSON({ ...empty, packs: ['zeta', 'data', 'alpha', 'architecture'] }));
    expect(out.packs).toEqual(['architecture', 'data', 'alpha', 'zeta']);
  });
});
