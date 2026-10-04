import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  createEditor,
  DeckEditError,
  fromJSON,
  groupingModeOf,
  isSchemaGroupId,
  observeDeck,
  schemaGroupId,
  serializeDeck,
  splitStoredGroups,
  toJSON,
  type DeckEditor,
} from '../src';
import { expectConverged, expectValid, seqIds, shopDeck, sync, twoDocs } from './helpers';

function setup(file: SododeckFile = shopDeck()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds() });
  return { doc, editor, deck: () => toJSON(doc) };
}

/** Runs `fn` and asserts it is exactly one undo step that restores the deck. */
function oneStep(editor: DeckEditor, deck: () => SododeckFile, fn: () => void): void {
  const before = serializeDeck(deck());
  fn();
  expect(serializeDeck(deck())).not.toBe(before);
  expect(editor.undo()).toBe(true);
  expect(serializeDeck(deck())).toBe(before);
  expect(editor.redo()).toBe(true);
}

const plain = (): SododeckFile => {
  const file = shopDeck();
  delete file.groupingMode;
  return file;
};

describe('grouping mode (048 T006)', () => {
  it('reads By group when absent, from a file and from a document', () => {
    const { doc } = setup(plain());
    expect(groupingModeOf(plain())).toBe('group');
    expect(groupingModeOf(doc)).toBe('group');
    expect(groupingModeOf({ ...plain(), groupingMode: 'schema' })).toBe('schema');
  });

  it('writes the key in one undo step; group and null remove it', () => {
    const { editor, deck, doc } = setup(plain());
    oneStep(editor, deck, () => {
      editor.setGroupingMode('schema');
    });
    expect(deck().groupingMode).toBe('schema');
    expect(groupingModeOf(doc)).toBe('schema');
    expectValid(doc);
    editor.setGroupingMode('group');
    expect(deck()).not.toHaveProperty('groupingMode');
    editor.setGroupingMode('schema');
    editor.setGroupingMode(null);
    expect(deck()).not.toHaveProperty('groupingMode');
    expect(groupingModeOf(doc)).toBe('group');
  });

  it('writes no transaction when the mode already is as asked', () => {
    const { editor, deck } = setup(plain());
    const before = serializeDeck(deck());
    editor.setGroupingMode('group');
    editor.setGroupingMode(null);
    expect(serializeDeck(deck())).toBe(before);
    expect(editor.undo()).toBe(false);
  });

  it('refuses any other value and writes nothing', () => {
    const { editor, deck } = setup(plain());
    const before = serializeDeck(deck());
    let code: string | null = null;
    try {
      editor.setGroupingMode('tag' as never);
    } catch (error) {
      code = error instanceof DeckEditError ? error.code : 'other';
    }
    expect(code).toBe('invalid');
    expect(serializeDeck(deck())).toBe(before);
  });

  it('round-trips a file with the key and a file without it, byte for byte', () => {
    const withMode = { ...plain(), groupingMode: 'schema' } as const;
    expect(serializeDeck(toJSON(fromJSON(withMode)))).toBe(serializeDeck(withMode));
    expect(serializeDeck(toJSON(fromJSON(plain())))).toBe(serializeDeck(plain()));
    expect(toJSON(fromJSON(emptySododeckFile()))).not.toHaveProperty('groupingMode');
  });

  it('reports the change on meta', () => {
    const { editor, doc } = setup(plain());
    const seen: string[] = [];
    const stop = observeDeck(doc, ({ changes }) => {
      for (const c of changes) seen.push(`${c.scope}:${c.id}:${c.kind}:${c.keys.join(',')}`);
    });
    editor.setGroupingMode('schema');
    stop();
    expect(seen).toEqual(['meta::updated:groupingMode']);
  });

  it('converges when two replicas set and clear it, in both delivery orders', () => {
    for (const order of ['ab', 'ba'] as const) {
      const { a, b } = twoDocs(plain());
      a.editor.setGroupingMode('schema');
      b.editor.setDialect('mysql');
      sync(a, b, order);
      expectConverged(a, b);
      expect(toJSON(b.doc).groupingMode).toBe('schema');
      expect(toJSON(b.doc).dialect).toBe('mysql');
      // Concurrent set and clear: both replicas agree on one winner.
      a.editor.setGroupingMode(null);
      b.editor.setGroupingMode('schema');
      sync(a, b, order);
      expectConverged(a, b);
    }
  });
});

describe('virtual schema group ids (048 T008)', () => {
  it('names a schema group "schema:<name>" and recognises only that prefix', () => {
    expect(schemaGroupId('billing')).toBe('schema:billing');
    expect(isSchemaGroupId('schema:billing')).toBe(true);
    expect(isSchemaGroupId('schema:')).toBe(true);
    expect(isSchemaGroupId('billing')).toBe(false);
    expect(isSchemaGroupId('my-schema:x')).toBe(false);
    expect(isSchemaGroupId('Schema:x')).toBe(false);
  });

  it('skips a stored group whose id starts with schema: and reports it', () => {
    const groups = [
      { id: 'core', title: 'Core' },
      { id: 'schema:billing', title: 'Billing' },
      { id: 'data', title: 'Data' },
    ];
    const { groups: kept, skipped } = splitStoredGroups(groups);
    expect(kept.map((g) => g.id)).toEqual(['core', 'data']);
    expect(skipped).toEqual([
      {
        path: 'groups.1.id',
        message: 'Group id "schema:billing" is reserved for schema groups and is not used.',
      },
    ]);
  });

  it('keeps every group of a deck without a collision, and the same array identity', () => {
    const groups = [{ id: 'core', title: 'Core' }];
    const result = splitStoredGroups(groups);
    expect(result.groups).toBe(groups);
    expect(result.skipped).toEqual([]);
  });

  it('never generates such an id for a group made in the editor', () => {
    const { editor, deck } = setup(plain());
    const id = editor.add('groups', { title: 'schema:billing' });
    expect(isSchemaGroupId(id)).toBe(false);
    expect(deck().groups.some((g) => isSchemaGroupId(g.id))).toBe(false);
  });
});
