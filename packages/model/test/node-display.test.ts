import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, fromJSON, getObject, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'db',
      type: 'database',
      title: 'Orders DB',
      description: 'Holds orders.',
      tags: ['pci'],
      style: { fill: 'blue' },
    },
    { id: 'ok', type: 'decision', title: 'OK?' },
    { id: 'svc', type: 'service', title: 'Svc' },
    { id: 'dia', type: 'diamond', title: 'Diamond' },
  ],
};

function setup(file: SododeckFile = deck) {
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

describe('setNodeDisplay (031, R4)', () => {
  it('switches several nodes to shape form in one undo step, keeping every other key', () => {
    const { doc, editor } = setup();
    editor.setNodeDisplay(['db', 'ok'], 'shape');
    expect(getObject(doc, 'nodes', 'db')).toEqual({ ...deck.nodes[0], display: 'shape' });
    expect(getObject(doc, 'nodes', 'ok')).toEqual({ ...deck.nodes[1], display: 'shape' });
    editor.undo();
    expect(getObject(doc, 'nodes', 'db')).toEqual(deck.nodes[0]);
    expect(getObject(doc, 'nodes', 'ok')).toEqual(deck.nodes[1]);
    expect(editor.canUndo()).toBe(false);
    expectValid(doc);
  });

  it('removes the key when the form equals the type family, or for null', () => {
    const { doc, editor } = setup();
    editor.setNodeDisplay(['db'], 'shape');
    editor.setNodeDisplay(['db'], 'card');
    expect(getObject(doc, 'nodes', 'db')).toEqual(deck.nodes[0]);
    editor.setNodeDisplay(['db'], 'shape');
    editor.setNodeDisplay(['db'], null);
    expect(getObject(doc, 'nodes', 'db')).toEqual(deck.nodes[0]);
    // A shape-family type never stores `shape`.
    editor.setNodeDisplay(['dia'], 'shape');
    expect(getObject(doc, 'nodes', 'dia')).toEqual(deck.nodes[3]);
  });

  it('writes nothing when no node changes (no empty undo step)', () => {
    const { editor } = setup();
    editor.setNodeDisplay(['db', 'svc'], 'card');
    expect(editor.canUndo()).toBe(false);
  });

  it('rejects an invalid display and unknown ids without writing', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    expect(
      codeOf(() => {
        editor.setNodeDisplay(['db'], 'icon' as 'card');
      }),
    ).toBe('invalid');
    expect(
      codeOf(() => {
        editor.setNodeDisplay(['db', 'nope'], 'shape');
      }),
    ).toBe('not-found');
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('round-trips both forms and keeps display after unrelated edits', () => {
    const file: SododeckFile = {
      ...deck,
      nodes: [
        { id: 'db', type: 'database', display: 'shape', title: 'Orders DB' },
        { id: 'ok', type: 'decision', display: 'card', title: 'OK?' },
        { id: 'svc', type: 'service', display: 'shape', title: 'Svc' },
      ],
    };
    const { doc, editor } = setup(file);
    expect(toJSON(doc)).toEqual(file);
    editor.update('nodes', 'svc', { title: 'Service' });
    expect(getObject(doc, 'nodes', 'svc')).toEqual({
      id: 'svc',
      type: 'service',
      display: 'shape',
      title: 'Service',
    });
  });
});
