import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, serializeDeck, toJSON } from '../src';
import { expectValid } from './helpers';

function setup(file: SododeckFile = emptySododeckFile()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc);
  return { doc, editor, deck: () => toJSON(doc) };
}

describe('blockSqlExport (052)', () => {
  it('round-trips a deck with the flag, and keeps a deck without it unchanged', () => {
    const withFlag: SododeckFile = { ...emptySododeckFile(), blockSqlExport: true };
    const { deck } = setup(withFlag);
    expect(deck().blockSqlExport).toBe(true);
    expect(serializeDeck(deck())).toBe(serializeDeck(withFlag));

    const plain = setup();
    plain.editor.setDialect('mysql');
    expect(plain.deck()).not.toHaveProperty('blockSqlExport');
  });

  it('writes true, removes the key on false, one undo step each', () => {
    const { doc, editor, deck } = setup();
    editor.setBlockSqlExport(true);
    expect(deck().blockSqlExport).toBe(true);
    expectValid(doc);
    expect(editor.undo()).toBe(true);
    expect(deck()).not.toHaveProperty('blockSqlExport');
    expect(editor.redo()).toBe(true);
    editor.setBlockSqlExport(false);
    expect(deck()).not.toHaveProperty('blockSqlExport');
    expect(editor.undo()).toBe(true);
    expect(deck().blockSqlExport).toBe(true);
  });

  it('writes nothing when the value is unchanged', () => {
    const { editor, deck } = setup();
    editor.setBlockSqlExport(false);
    expect(editor.undo()).toBe(false);
    expect(deck()).not.toHaveProperty('blockSqlExport');
  });
});
