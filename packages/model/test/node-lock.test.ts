import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, getObject, isLocked, toJSON } from '../src';
import { DeckEditError } from '../src';
import { expectValid, seqIds } from './helpers';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  stickies: [
    { id: 'note', text: 'Note', position: { x: 10, y: 20 } },
    { id: 'note2', text: 'Note 2', position: { x: 30, y: 40 }, size: { width: 200, height: 200 } },
  ],
  edges: [
    { id: 'link', from: 'svc', to: 'dia' },
    { id: 'link2', from: 'note', to: 'svc' },
  ],
  nodes: [
    { id: 'svc', type: 'service', title: 'Svc' },
    { id: 'dia', type: 'diamond', title: 'Diamond' },
    {
      id: 'tbl',
      type: 'db-table',
      title: 'orders',
      columns: [{ id: 'o-id', name: 'id', type: 'bigint', pk: true }],
    },
  ],
};

function setup(file: SododeckFile = deck) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds(), captureTimeout: 0 }) };
}

describe('setLocked (043, R11)', () => {
  it('writes locked: true on every listed node, keeping every other key', () => {
    const { doc, editor } = setup();
    editor.setLocked(['svc', 'dia', 'tbl'], true);
    expect(getObject(doc, 'nodes', 'svc')).toEqual({ ...deck.nodes[0], locked: true });
    expect(getObject(doc, 'nodes', 'dia')).toEqual({ ...deck.nodes[1], locked: true });
    expect(getObject(doc, 'nodes', 'tbl')).toEqual({ ...deck.nodes[2], locked: true });
    expectValid(doc);
  });

  it('removes the key on unlock, never writing locked: false', () => {
    const { doc, editor } = setup();
    editor.setLocked(['svc', 'tbl'], true);
    editor.setLocked(['svc', 'tbl'], false);
    expect(toJSON(doc)).toEqual(toJSON(fromJSON(deck)));
    expect(getObject(doc, 'nodes', 'svc')).not.toHaveProperty('locked');
  });

  it('ignores unknown ids', () => {
    const { doc, editor } = setup();
    editor.setLocked(['nope', 'svc'], true);
    expect(getObject(doc, 'nodes', 'svc')?.locked).toBe(true);
    const { editor: other } = setup();
    other.setLocked(['nope'], true);
    expect(other.canUndo()).toBe(false);
  });

  it('is one undo step, and writes nothing when nothing changes', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.setLocked(['svc', 'dia'], true);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
    editor.setLocked(['svc'], false);
    expect(editor.canUndo()).toBe(false);
    editor.setLocked(['svc'], true);
    editor.setLocked(['svc'], true);
    expect(editor.undo()).toBe(true);
    expect(editor.canUndo()).toBe(false);
  });
});

describe('isLocked (043)', () => {
  it('is true only for locked: true', () => {
    expect(isLocked({ locked: true })).toBe(true);
    expect(isLocked({})).toBe(false);
  });
});

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return null;
}

describe('lock on stickies and connectors (053, R9)', () => {
  it('locks and unlocks a sticky and a connector, keeping every other key', () => {
    const { doc, editor } = setup();
    editor.setLocked(['note'], true, 'stickies');
    editor.setLocked(['link', 'link2'], true, 'edges');
    expect(getObject(doc, 'stickies', 'note')).toEqual({ ...deck.stickies[0], locked: true });
    expect(getObject(doc, 'edges', 'link')).toEqual({ ...deck.edges[0], locked: true });
    expect(getObject(doc, 'edges', 'link2')).toEqual({ ...deck.edges[1], locked: true });
    expectValid(doc);
    editor.setLocked(['note'], false, 'stickies');
    editor.setLocked(['link', 'link2'], false, 'edges');
    expect(toJSON(doc)).toEqual(toJSON(fromJSON(deck)));
  });

  it('defaults to nodes, so existing callers are unchanged', () => {
    const { doc, editor } = setup();
    editor.setLocked(['svc'], true);
    expect(getObject(doc, 'nodes', 'svc')?.locked).toBe(true);
    expect(getObject(doc, 'stickies', 'note')).not.toHaveProperty('locked');
  });

  it('does not lock a sticky through the nodes collection, and ignores unknown ids', () => {
    const { editor } = setup();
    editor.setLocked(['note'], true);
    editor.setLocked(['nope'], true, 'edges');
    expect(editor.canUndo()).toBe(false);
  });

  it('is one undo step per call', () => {
    const { doc, editor } = setup();
    const before = toJSON(doc);
    editor.setLocked(['note', 'note2'], true, 'stickies');
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
  });

  it('a locked sticky refuses move, resize and delete; unlock allows them', () => {
    const { doc, editor } = setup();
    editor.setLocked(['note'], true, 'stickies');
    const locked = toJSON(doc);
    expect(
      codeOf(() => {
        editor.moveSticky('note', { x: 0, y: 0 });
      }),
    ).toBe('locked');
    expect(
      codeOf(() => {
        editor.setStickySize('note', { width: 300, height: 300 });
      }),
    ).toBe('locked');
    expect(codeOf(() => editor.remove('stickies', 'note'))).toBe('locked');
    expect(toJSON(doc)).toEqual(locked);
    editor.setLocked(['note'], false, 'stickies');
    editor.moveSticky('note', { x: 0, y: 0 });
    editor.setStickySize('note', { width: 300, height: 300 });
    editor.remove('stickies', 'note');
    expect(getObject(doc, 'stickies', 'note')).toBeUndefined();
  });

  it('a locked sticky can still be a connector target, edited in text and recoloured', () => {
    const { doc, editor } = setup();
    editor.setLocked(['note'], true, 'stickies');
    editor.add('edges', { id: 'new', from: 'svc', to: 'note' });
    editor.update('stickies', 'note', { text: 'Edited' });
    editor.setStickyColour(['note'], 'blue');
    expect(getObject(doc, 'stickies', 'note')).toMatchObject({ text: 'Edited', color: 'blue' });
  });

  it('a locked connector refuses reconnect, reshape and delete; unlock allows them', () => {
    const { doc, editor } = setup();
    editor.setLocked(['link'], true, 'edges');
    const locked = toJSON(doc);
    expect(
      codeOf(() => {
        editor.update('edges', 'link', { to: 'tbl' });
      }),
    ).toBe('locked');
    expect(
      codeOf(() => {
        editor.setEdgeRoute('link', { fromSide: 'left' });
      }),
    ).toBe('locked');
    expect(
      codeOf(() => {
        editor.setEdgeShape(['link'], 'curved');
      }),
    ).toBe('locked');
    expect(codeOf(() => editor.remove('edges', 'link'))).toBe('locked');
    expect(toJSON(doc)).toEqual(locked);
    editor.setLocked(['link'], false, 'edges');
    editor.setEdgeRoute('link', { fromSide: 'left' });
    editor.remove('edges', 'link');
    expect(getObject(doc, 'edges', 'link')).toBeUndefined();
  });

  it('a locked connector can still be relabelled and goes when an end is deleted', () => {
    const { doc, editor } = setup();
    editor.setLocked(['link'], true, 'edges');
    editor.update('edges', 'link', { label: 'calls' });
    expect(getObject(doc, 'edges', 'link')?.label).toBe('calls');
    editor.remove('nodes', 'svc');
    expect(getObject(doc, 'edges', 'link')).toBeUndefined();
    expect(editor.undo()).toBe(true);
    expect(getObject(doc, 'edges', 'link')?.locked).toBe(true);
  });
});
