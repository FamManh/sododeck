import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createDeck, createEditor, fromJSON, toJSON } from '../src';
import { readExample } from './helpers';

const example = await readExample('minimal.sododeck.json');

/** Writes a node straight into the stored layout (036 layout 2: keyed by id, no editor op). */
function pushNode(doc: Y.Doc, id: string): void {
  const map = new Y.Map<unknown>();
  map.set('type', 'service');
  map.set('title', id);
  doc.getMap<Y.Map<unknown>>('nodes').set(id, map);
}

describe('editor core', () => {
  it('starts with nothing to undo after a load', () => {
    const editor = createEditor(fromJSON(example));
    expect(editor.canUndo()).toBe(false);
    expect(editor.canRedo()).toBe(false);
    expect(editor.undo()).toBe(false);
  });

  it('makes a batch one undo step and returns its result', () => {
    const doc = createDeck();
    const editor = createEditor(doc, { captureTimeout: 0 });
    const result = editor.batch(() => {
      pushNode(doc, 'a');
      editor.batch(() => {
        pushNode(doc, 'b');
      });
      return 42;
    });
    expect(result).toBe(42);
    expect(toJSON(doc).nodes).toHaveLength(2);

    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).nodes).toHaveLength(0);
    expect(editor.canUndo()).toBe(false);
    expect(editor.redo()).toBe(true);
    expect(toJSON(doc).nodes).toHaveLength(2);
  });

  it('never undoes edits made outside the editor', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    doc.transact(() => {
      pushNode(doc, 'no-origin');
    });
    doc.transact(() => {
      pushNode(doc, 'other-origin');
    }, 'another-tab');
    expect(editor.canUndo()).toBe(false);
    expect(editor.undo()).toBe(false);
    expect(toJSON(doc).nodes).toHaveLength(2);
  });

  it('stops tracking after destroy', () => {
    const doc = createDeck();
    const editor = createEditor(doc);
    editor.destroy();
    editor.batch(() => {
      pushNode(doc, 'a');
    });
    expect(editor.canUndo()).toBe(false);
  });
});
